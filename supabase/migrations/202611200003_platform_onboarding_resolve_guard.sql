-- Follow-up to 202611200002 (review R1/R2). Records when a link is claimed so the
-- platform cannot resolve a redemption that is still in progress, and only
-- finishes setup for a confirmed login created after that claim.
-- `create or replace` keeps existing grants. Installed together with 202611200002.
begin;

alter table public.platform_owner_invitations add column if not exists claimed_at timestamptz;

create or replace function public.platform_claim_owner_invitation(p_token_hash text, p_claim_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare attempts_now integer; token_attempts integer; invitation public.platform_owner_invitations%rowtype;
begin
 -- A return (rather than an exception) persists the shared rate-limit count.
 insert into public.platform_owner_invitation_rate(singleton,window_start,attempts) values(true,clock_timestamp(),1)
 on conflict(singleton) do update set
  attempts=case when public.platform_owner_invitation_rate.window_start <= clock_timestamp() - interval '1 minute' then 1 else public.platform_owner_invitation_rate.attempts+1 end,
  window_start=case when public.platform_owner_invitation_rate.window_start <= clock_timestamp() - interval '1 minute' then clock_timestamp() else public.platform_owner_invitation_rate.window_start end
 returning attempts into attempts_now;
 if attempts_now > 600 or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_claim_id is null then return null; end if;
 delete from public.platform_owner_invitation_token_rate where window_start < clock_timestamp() - interval '10 minutes';
 -- Lock businesses before invitations consistently with issuance to avoid
 -- lock-order inversions when an invitation is reissued while being claimed.
 select * into invitation from public.platform_owner_invitations where token_hash=p_token_hash;
 if not found or invitation.state<>'issued' or invitation.expires_at <= clock_timestamp() then return null; end if;
 insert into public.platform_owner_invitation_token_rate(token_hash,window_start,attempts) values(p_token_hash,clock_timestamp(),1)
 on conflict(token_hash) do update set
  attempts=case when public.platform_owner_invitation_token_rate.window_start <= clock_timestamp() - interval '1 minute' then 1 else public.platform_owner_invitation_token_rate.attempts+1 end,
  window_start=case when public.platform_owner_invitation_token_rate.window_start <= clock_timestamp() - interval '1 minute' then clock_timestamp() else public.platform_owner_invitation_token_rate.window_start end
 returning attempts into token_attempts;
 if token_attempts > 5 then return null; end if;
 perform 1 from public.businesses where id=invitation.business_id and status='provisioning' and not isolation_ready for update;
 if not found then return null; end if;
 select * into invitation from public.platform_owner_invitations where token_hash=p_token_hash for update;
 if not found or invitation.state<>'issued' or invitation.expires_at <= clock_timestamp()
    or to_regprocedure('public.current_business_id()') is null
    or exists(select 1 from public.business_memberships where business_id=invitation.business_id and role::text='CENTRAL_ADMIN')
    or exists(select 1 from public.businesses where status='active' and not isolation_ready)
    or not exists(select 1 from public.platform_administrators a join public.profiles p on p.id=a.user_id where a.user_id=invitation.issued_by and a.is_active and p.status::text='active') then return null; end if;
 update public.platform_owner_invitations set state='processing',claim_id=p_claim_id,claimed_at=clock_timestamp() where id=invitation.id;
 return jsonb_build_object('invitation_id',invitation.id,'email',invitation.email,'name',invitation.name);
end; $$;

create or replace function public.platform_release_owner_invitation(p_invitation_id uuid, p_claim_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation public.platform_owner_invitations%rowtype;
begin
 select * into invitation from public.platform_owner_invitations where id=p_invitation_id;
 if not found or invitation.state<>'processing' or invitation.claim_id is distinct from p_claim_id then return false; end if;
 perform 1 from public.businesses where id=invitation.business_id for update;
 update public.platform_owner_invitations set state='issued',claim_id=null,claimed_at=null
   where id=p_invitation_id and state='processing' and claim_id=p_claim_id;
 return found;
end; $$;

create or replace function public.platform_resolve_owner_invitation(p_business_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare invitation public.platform_owner_invitations%rowtype; business public.businesses%rowtype; invitee uuid;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 select * into business from public.businesses where id=p_business_id for update;
 if not found then return 'none'; end if;
 select * into invitation from public.platform_owner_invitations where business_id=p_business_id and state='processing' for update;
 if not found then return 'none'; end if;
 -- A normal redemption finishes within seconds; do not race one still in progress.
 if invitation.claimed_at is not null and invitation.claimed_at > clock_timestamp() - interval '5 minutes' then
   raise exception 'Setup is still in progress; try again in a few minutes' using errcode='55000';
 end if;
 -- Only a confirmed login created after this claim (by the accept handler) is adopted.
 select p.id into invitee from public.profiles p join auth.users u on u.id=p.id
   where lower(u.email)=invitation.email and p.status::text='pending'
     and u.email_confirmed_at is not null
     and u.created_at >= coalesce(invitation.claimed_at, invitation.created_at)
     and not exists(select 1 from public.business_memberships m where m.user_id=p.id)
   for update of p;
 if invitee is not null and business.status='provisioning' and not business.isolation_ready
    and not exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN') then
   update public.profiles set full_name=invitation.name,status='active',updated_at=clock_timestamp() where id=invitee;
   insert into public.business_memberships(business_id,user_id,role,status,location_id) values(p_business_id,invitee,'CENTRAL_ADMIN','active',null);
   update public.platform_owner_invitations set state='completed',completed_at=clock_timestamp() where id=invitation.id;
   insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
   values(auth.uid(),'new_business_owner',p_business_id::text||'/'||invitee::text,'INSERT',jsonb_build_object('business_id',p_business_id,'user_id',invitee,'resolved',true));
   return 'completed';
 end if;
 update public.platform_owner_invitations set state='revoked',claim_id=null,claimed_at=null where id=invitation.id;
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(auth.uid(),'owner_invitation',p_business_id::text,'UPDATE',jsonb_build_object('business_id',p_business_id,'state','revoked','resolved',true,'claim_id',invitation.claim_id));
 return 'revoked';
end; $$;

notify pgrst,'reload schema';
commit;
