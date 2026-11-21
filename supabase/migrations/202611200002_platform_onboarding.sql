-- Platform onboarding package (Phase 1). The single source for platform onboarding
-- SQL; it replaced the deleted platform_console, registration-only, existing-owner
-- and invitation drafts (including the removed temporary-password functions). Pool model: every business shares the database and is
-- separated by business_id. No email is sent and no platform role is granted.
--
-- Flow: register (provisioning) -> invite first admin (one-time 24h link, or
-- assign an existing active account) -> admin accepts -> platform activates.
-- Installed on staging 2026-11-20 (not production). Not idempotent: do not replay
-- where installed. Apply 202611200003 after it.
begin;

-- 1. Registration, existing-account assignment and activation ---------------

create function public.platform_create_business(p_name text, p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result public.businesses;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 or p_slug is null
   or length(p_slug) not between 2 and 60 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
   raise exception 'Invalid business details' using errcode='22023';
 end if;
 insert into public.businesses(name,slug,status,isolation_ready)
 values(trim(p_name),p_slug,'provisioning',false) returning * into result;
 return jsonb_build_object('id',result.id,'name',result.name,'slug',result.slug,'status',result.status,'isolation_ready',result.isolation_ready);
end; $$;
revoke all on function public.platform_create_business(text,text) from public,anon;
grant execute on function public.platform_create_business(text,text) to authenticated;

create function public.platform_assign_initial_owner(p_business_id uuid,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid; business public.businesses%rowtype;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if to_regprocedure('public.current_business_id()') is null then raise exception 'Business isolation is not installed' using errcode='55000'; end if;
 if p_email is null or length(trim(p_email)) not between 3 and 254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email' using errcode='22023'; end if;
 select * into business from public.businesses where id=p_business_id for update;
 if not found or business.status<>'provisioning' or business.isolation_ready then raise exception 'Business is not awaiting setup' using errcode='55000'; end if;
 if exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN') then raise exception 'An initial admin has already been assigned' using errcode='23505'; end if;
 -- An invitation being redeemed may already have created a login: resolve it first.
 if exists(select 1 from public.platform_owner_invitations where business_id=p_business_id and state='processing') then
   raise exception 'An invitation is being redeemed; resolve it first' using errcode='55000';
 end if;
 begin
   select p.id into strict target from public.profiles p where lower(p.email)=lower(trim(p_email)) and p.status::text='active' for update;
 exception
   when no_data_found then raise exception 'An active account with this email was not found' using errcode='P0002';
   when too_many_rows then raise exception 'Multiple active accounts match this email' using errcode='P0003';
 end;
 insert into public.business_memberships(business_id,user_id,role,status,location_id)
 values(p_business_id,target,'CENTRAL_ADMIN','active',null) on conflict do nothing;
 if not found then raise exception 'This account already has a membership' using errcode='23505'; end if;
 -- The admin is now assigned; any unused invitation link must stop working.
 update public.platform_owner_invitations set state='revoked' where business_id=p_business_id and state='issued';
end; $$;
revoke all on function public.platform_assign_initial_owner(uuid,text) from public,anon;
grant execute on function public.platform_assign_initial_owner(uuid,text) to authenticated;

-- A platform admin may activate only an isolated, provisioning business with
-- exactly one active first admin. Isolation checks are defensive configuration
-- checks, not a replacement for authenticated cross-business acceptance tests.
create function public.activate_platform_business(p_business_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 business public.businesses%rowtype;
 table_name text;
 owner_count integer;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if to_regprocedure('public.current_business_id()') is null then raise exception 'Business isolation is not installed' using errcode='55000'; end if;
 if not exists(select 1 from pg_catalog.pg_roles where rolname='ahaa_operations' and not rolcanlogin and not rolbypassrls and not rolsuper) then
   raise exception 'Business isolation is not ready' using errcode='55000';
 end if;
 foreach table_name in array array['locations','catalog_categories','catalog_units','catalog_items','orders','order_lines',
   'pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','weekly_invoices',
   'weekly_invoice_publications','invoice_edits','catering_events','purchase_receipts'] loop
   if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname=table_name and c.relrowsecurity)
     or not exists(select 1 from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename=table_name
       and p.policyname='business_boundary' and p.permissive='RESTRICTIVE'
       and p.qual like '%business_id%' and p.qual like '%current_business_id%'
       and p.with_check like '%business_id%' and p.with_check like '%current_business_id%') then
     raise exception 'Business isolation is not ready' using errcode='55000';
   end if;
 end loop;
 if exists(select 1 from public.businesses where status='active' and not isolation_ready) then
   raise exception 'An active business is not isolated' using errcode='55000';
 end if;
 select * into business from public.businesses where id=p_business_id for update;
 if not found then raise exception 'Business was not found' using errcode='P0002'; end if;
 if business.status<>'provisioning' or business.isolation_ready then raise exception 'Business is not awaiting activation' using errcode='55000'; end if;
 select count(*) into owner_count from public.business_memberships m join public.profiles p on p.id=m.user_id
   where m.business_id=p_business_id and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and p.status::text='active';
 if owner_count<>1 then raise exception 'Assign exactly one active business admin before activation' using errcode='55000'; end if;
 update public.businesses set status='active',isolation_ready=true,updated_at=clock_timestamp()
   where id=p_business_id returning * into business;
 return jsonb_build_object('id',business.id,'name',business.name,'slug',business.slug,'status',business.status,'isolation_ready',business.isolation_ready);
end; $$;
revoke all on function public.activate_platform_business(uuid) from public,anon;
grant execute on function public.activate_platform_business(uuid) to authenticated;


-- 2. Owner invitations -------------------------------------------------------

create table public.platform_owner_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  issued_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  email text not null check (length(email) between 3 and 254),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'issued' check (state in ('issued','processing','completed','revoked')),
  claim_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  check ((state in ('processing','completed')) = (claim_id is not null))
);
create unique index platform_owner_one_open_invitation on public.platform_owner_invitations(business_id)
  where state in ('issued','processing');
alter table public.platform_owner_invitations enable row level security;
revoke all on public.platform_owner_invitations from public, anon, authenticated;

-- A high shared ceiling is a final cost guard across serverless instances.
-- No IP addresses or raw tokens are stored.
create table public.platform_owner_invitation_rate (
  singleton boolean primary key default true check (singleton),
  window_start timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table public.platform_owner_invitation_rate enable row level security;
revoke all on public.platform_owner_invitation_rate from public, anon, authenticated;

-- Per-invitation buckets are created only for hashes already present in the
-- invitation table: arbitrary unauthenticated guesses cannot allocate rows.
-- Old buckets are removed on the next claim attempt; the index bounds cleanup.
create table public.platform_owner_invitation_token_rate (
  token_hash text primary key references public.platform_owner_invitations(token_hash) on delete cascade,
  window_start timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0)
);
create index platform_owner_invitation_token_rate_expiry on public.platform_owner_invitation_token_rate(window_start);
alter table public.platform_owner_invitation_token_rate enable row level security;
revoke all on public.platform_owner_invitation_token_rate from public, anon, authenticated;

create function public.platform_issue_owner_invitation(p_business_id uuid, p_name text, p_email text, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare deadline timestamptz := clock_timestamp() + interval '24 hours';
begin
 if not public.platform_is_administrator() then raise exception 'Platform access required' using errcode='42501'; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 or p_email is null or length(trim(p_email)) not between 3 and 254
    or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_token_hash !~ '^[0-9a-f]{64}$' then
   raise exception 'Invalid invitation details' using errcode='22023';
 end if;
 if to_regprocedure('public.current_business_id()') is null or exists(select 1 from public.businesses where status='active' and not isolation_ready) then
   raise exception 'Isolation is not ready' using errcode='55000';
 end if;
 perform 1 from public.businesses where id=p_business_id and status='provisioning' and not isolation_ready for update;
 if not found or exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN') then
   raise exception 'Business is not awaiting an admin' using errcode='55000';
 end if;
 if exists(select 1 from auth.users where lower(email)=lower(trim(p_email))) then
   raise exception 'Use existing account assignment' using errcode='23505';
 end if;
 if (select count(*) from public.platform_owner_invitations where business_id=p_business_id and created_at > clock_timestamp() - interval '1 hour') >= 3 then
   raise exception 'Invitation limit reached' using errcode='55000';
 end if;
 -- A claimed invitation can have an uncertain Auth outcome. Never silently
 -- supersede it, even after expiry; an operator must reconcile it first.
 if exists(select 1 from public.platform_owner_invitations where business_id=p_business_id and state='processing') then
   raise exception 'Invitation outcome requires review' using errcode='55000';
 end if;
 update public.platform_owner_invitations set state='revoked' where business_id=p_business_id and state='issued';
 insert into public.platform_owner_invitations(business_id,issued_by,name,email,token_hash,expires_at)
 values(p_business_id,auth.uid(),trim(p_name),lower(trim(p_email)),p_token_hash,deadline);
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(auth.uid(),'owner_invitation',p_business_id::text,'INSERT',jsonb_build_object('business_id',p_business_id,'expires_at',deadline));
 return deadline;
end; $$;
revoke all on function public.platform_issue_owner_invitation(uuid,text,text,text) from public,anon;
grant execute on function public.platform_issue_owner_invitation(uuid,text,text,text) to authenticated;

create function public.platform_claim_owner_invitation(p_token_hash text, p_claim_id uuid)
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
 update public.platform_owner_invitations set state='processing',claim_id=p_claim_id where id=invitation.id;
 return jsonb_build_object('invitation_id',invitation.id,'email',invitation.email,'name',invitation.name);
end; $$;
revoke all on function public.platform_claim_owner_invitation(text,uuid) from public,anon,authenticated;
grant execute on function public.platform_claim_owner_invitation(text,uuid) to service_role;

create function public.platform_complete_owner_invitation(p_invitation_id uuid, p_claim_id uuid, p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation public.platform_owner_invitations%rowtype;
begin
 select * into invitation from public.platform_owner_invitations where id=p_invitation_id;
 if not found or invitation.state<>'processing' or invitation.claim_id is distinct from p_claim_id then return false; end if;
 perform 1 from public.businesses where id=invitation.business_id and status='provisioning' and not isolation_ready for update;
 if not found then return false; end if;
 select * into invitation from public.platform_owner_invitations where id=p_invitation_id for update;
 if not found or invitation.state<>'processing' or invitation.claim_id is distinct from p_claim_id
    or to_regprocedure('public.current_business_id()') is null
    or exists(select 1 from public.business_memberships where business_id=invitation.business_id and role::text='CENTRAL_ADMIN')
    or exists(select 1 from public.businesses where status='active' and not isolation_ready)
    or not exists(select 1 from public.platform_administrators a join public.profiles p on p.id=a.user_id where a.user_id=invitation.issued_by and a.is_active and p.status::text='active') then return false; end if;
 perform 1 from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id and p.status::text='pending' and lower(u.email)=invitation.email for update of p;
 if not found or exists(select 1 from public.business_memberships where user_id=p_user_id) then return false; end if;
 update public.profiles set full_name=invitation.name,status='active',updated_at=clock_timestamp() where id=p_user_id;
 insert into public.business_memberships(business_id,user_id,role,status,location_id) values(invitation.business_id,p_user_id,'CENTRAL_ADMIN','active',null);
 update public.platform_owner_invitations set state='completed',completed_at=clock_timestamp() where id=invitation.id;
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(invitation.issued_by,'new_business_owner',invitation.business_id::text||'/'||p_user_id::text,'INSERT',jsonb_build_object('business_id',invitation.business_id,'user_id',p_user_id));
 return true;
end; $$;
revoke all on function public.platform_complete_owner_invitation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_complete_owner_invitation(uuid,uuid,uuid) to service_role;


-- 3. Invitation management ----------------------------------------------------
-- Latest invitation for each requested business (bounded to the console page).
-- Never returns token hashes.
create function public.platform_owner_invitation_summary(p_business_ids uuid[])
returns table(business_id uuid, name text, email text, state text, created_at timestamptz, expires_at timestamptz, completed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if p_business_ids is null or cardinality(p_business_ids) > 200 then raise exception 'Request at most 200 businesses' using errcode='22023'; end if;
 return query
   select distinct on (i.business_id) i.business_id, i.name, i.email, i.state, i.created_at, i.expires_at, i.completed_at
   from public.platform_owner_invitations i
   where i.business_id = any(p_business_ids)
   order by i.business_id, i.created_at desc, i.id desc;
end; $$;
revoke all on function public.platform_owner_invitation_summary(uuid[]) from public,anon;
grant execute on function public.platform_owner_invitation_summary(uuid[]) to authenticated;

-- Revokes an unused link. A link being redeemed ('processing') is never revoked
-- here: use platform_resolve_owner_invitation, which accounts for its login.
create function public.platform_revoke_owner_invitation(p_business_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 -- Lock the business before invitations, matching issuance and redemption.
 perform 1 from public.businesses where id=p_business_id for update;
 if not found then return false; end if;
 update public.platform_owner_invitations set state='revoked' where business_id=p_business_id and state='issued';
 if not found then return false; end if;
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(auth.uid(),'owner_invitation',p_business_id::text,'UPDATE',jsonb_build_object('business_id',p_business_id,'state','revoked'));
 return true;
end; $$;
revoke all on function public.platform_revoke_owner_invitation(uuid) from public,anon;
grant execute on function public.platform_revoke_owner_invitation(uuid) to authenticated;

-- Service-only: the accept handler returns a claim when Auth definitively
-- rejected account creation (no login exists), so the same link can be retried.
create function public.platform_release_owner_invitation(p_invitation_id uuid, p_claim_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare invitation public.platform_owner_invitations%rowtype;
begin
 select * into invitation from public.platform_owner_invitations where id=p_invitation_id;
 if not found or invitation.state<>'processing' or invitation.claim_id is distinct from p_claim_id then return false; end if;
 perform 1 from public.businesses where id=invitation.business_id for update;
 update public.platform_owner_invitations set state='issued',claim_id=null
   where id=p_invitation_id and state='processing' and claim_id=p_claim_id;
 return found;
end; $$;
revoke all on function public.platform_release_owner_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platform_release_owner_invitation(uuid,uuid) to service_role;

-- Platform recovery for an interrupted redemption. If the invitee's login was
-- created (pending, no memberships) the setup is finished; otherwise the
-- invitation is cancelled so a new link can be issued. Returns
-- 'completed', 'revoked' or 'none'.
create function public.platform_resolve_owner_invitation(p_business_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare invitation public.platform_owner_invitations%rowtype; business public.businesses%rowtype; invitee uuid;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 select * into business from public.businesses where id=p_business_id for update;
 if not found then return 'none'; end if;
 select * into invitation from public.platform_owner_invitations where business_id=p_business_id and state='processing' for update;
 if not found then return 'none'; end if;
 select p.id into invitee from public.profiles p join auth.users u on u.id=p.id
   where lower(u.email)=invitation.email and p.status::text='pending'
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
 update public.platform_owner_invitations set state='revoked',claim_id=null where id=invitation.id;
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(auth.uid(),'owner_invitation',p_business_id::text,'UPDATE',jsonb_build_object('business_id',p_business_id,'state','revoked','resolved',true,'claim_id',invitation.claim_id));
 return 'revoked';
end; $$;
revoke all on function public.platform_resolve_owner_invitation(uuid) from public,anon;
grant execute on function public.platform_resolve_owner_invitation(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
