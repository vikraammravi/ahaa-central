-- Staging first. Business registration only: no activation, customer data access,
-- identity creation or automatic platform-role grants. Existing audit trigger applies.
begin;
create function public.platform_create_business(p_name text, p_slug text) returns jsonb
language plpgsql security definer set search_path=''
as $$
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
end;
$$;
revoke all on function public.platform_create_business(text,text) from public,anon;
grant execute on function public.platform_create_business(text,text) to authenticated;

-- Assign an existing active identity as the first business admin. Account creation,
-- email delivery and activation remain separate explicit onboarding steps.
create function public.platform_assign_initial_owner(p_business_id uuid,p_email text) returns void
language plpgsql security definer set search_path=''
as $$
declare target uuid; business public.businesses%rowtype;
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if to_regprocedure('public.current_business_id()') is null then raise exception 'Business isolation is not installed' using errcode='55000'; end if;
 if p_email is null or length(trim(p_email)) not between 3 and 254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
   raise exception 'Enter a valid email' using errcode='22023';
 end if;
 select * into business from public.businesses where id=p_business_id for update;
 if not found or business.status<>'provisioning' or business.isolation_ready then raise exception 'Business is not awaiting setup' using errcode='55000'; end if;
 if exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN') then
   raise exception 'An initial admin has already been assigned' using errcode='23505';
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
end; $$;
revoke all on function public.platform_assign_initial_owner(uuid,text) from public,anon;
grant execute on function public.platform_assign_initial_owner(uuid,text) to authenticated;

-- A preflight prevents creating a pending identity before isolation exists.
-- The service-only assignment still repeats every check after Auth responds.
create function public.platform_can_create_owner(p_business_id uuid) returns boolean
language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.platform_is_administrator() then raise exception 'Platform access is required' using errcode='42501'; end if;
 if to_regprocedure('public.current_business_id()') is null then return false; end if;
 return not exists(select 1 from public.businesses where status='active' and not isolation_ready)
   and exists(select 1 from public.businesses where id=p_business_id and status='provisioning' and not isolation_ready)
   and not exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN');
end; $$;
revoke all on function public.platform_can_create_owner(uuid) from public,anon;
grant execute on function public.platform_can_create_owner(uuid) to authenticated;

-- Service-only completion for a newly created pending identity. The actor is
-- rechecked inside the transaction and a business lock serializes assignment.
-- The caller must preserve the Auth identity if the RPC outcome is uncertain.
create function public.platform_assign_new_owner(p_business_id uuid,p_actor_id uuid,p_user_id uuid,p_name text) returns boolean
language plpgsql security definer set search_path=''
as $$
begin
 if to_regprocedure('public.current_business_id()') is null then return false; end if;
 if not exists(select 1 from public.platform_administrators a join public.profiles p on p.id=a.user_id
   where a.user_id=p_actor_id and a.is_active and p.status::text='active') then return false; end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 then return false; end if;
 -- New identities cannot be created safely while any existing active business
 -- is still using legacy, non-isolated access.
 if exists(select 1 from public.businesses where status='active' and not isolation_ready) then return false; end if;
 perform 1 from public.businesses where id=p_business_id and status='provisioning' and not isolation_ready for update;
 if not found or exists(select 1 from public.business_memberships where business_id=p_business_id and role::text='CENTRAL_ADMIN') then return false; end if;
 perform 1 from public.profiles where id=p_user_id and status::text='pending' for update;
 if not found or exists(select 1 from public.business_memberships where user_id=p_user_id) then return false; end if;
 update public.profiles set full_name=trim(p_name),status='active',updated_at=clock_timestamp() where id=p_user_id;
 insert into public.business_memberships(business_id,user_id,role,status,location_id)
 values(p_business_id,p_user_id,'CENTRAL_ADMIN','active',null);
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(p_actor_id,'new_business_owner',p_business_id::text||'/'||p_user_id::text,'INSERT',jsonb_build_object('business_id',p_business_id,'user_id',p_user_id));
 return true;
end; $$;
revoke all on function public.platform_assign_new_owner(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.platform_assign_new_owner(uuid,uuid,uuid,text) to service_role;
commit;
