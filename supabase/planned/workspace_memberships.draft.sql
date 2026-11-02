-- INCOMPLETE RELEASE SET. STAGING REHEARSAL ONLY; pair with business isolation.
begin;

alter table public.business_memberships add constraint active_member_has_location
check(status::text<>'active' or role::text='CENTRAL_ADMIN' or location_id is not null);
create function public.guard_business_member_location() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status::text='active' and new.role::text in ('BRANCH_MANAGER','BRANCH_EMPLOYEE')
 and not exists(select 1 from public.locations where id=new.location_id and business_id=new.business_id and is_central is not true)
 then raise exception 'Assign this member to a branch in the same business'; end if;
 return new;
end; $$;
revoke all on function public.guard_business_member_location() from public,anon,authenticated;
create trigger membership_location_guard before insert or update on public.business_memberships for each row execute function public.guard_business_member_location();

create function public.my_workspaces() returns jsonb
language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('business_id',b.id,'name',b.name,'slug',b.slug,'role',m.role,
 'status',case when p.status::text='active' then m.status::text else 'disabled' end,
 'business_status',b.status,'isolation_ready',b.isolation_ready) order by b.name,b.id),'[]')
 from public.business_memberships m join public.businesses b on b.id=m.business_id join public.profiles p on p.id=m.user_id
 where m.user_id=auth.uid();
$$;
revoke all on function public.my_workspaces() from public,anon;
grant execute on function public.my_workspaces() to authenticated;

create function public.business_users(p_page integer default 0,p_search text default '',p_location_id uuid default null,p_status text default '') returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare total integer; page integer; rows jsonb;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'An active business admin is required'; end if;
 if p_status not in ('','active','pending','disabled') or length(p_search)>200 then raise exception 'Invalid user filters'; end if;
 select count(*) into total from app_private.workspace_profiles p
 where (p_location_id is null or p.location_id=p_location_id) and (p_status='' or p.status::text=p_status)
 and (trim(p_search)='' or position(lower(trim(p_search)) in lower(coalesce(p.full_name,'')||' '||p.email))>0);
 page=least(greatest(coalesce(p_page,0),0),greatest((total-1)/25,0));
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (
 select * from app_private.workspace_profiles p
 where (p_location_id is null or p.location_id=p_location_id) and (p_status='' or p.status::text=p_status)
 and (trim(p_search)='' or position(lower(trim(p_search)) in lower(coalesce(p.full_name,'')||' '||p.email))>0)
 order by full_name,id limit 25 offset page*25) r;
 return jsonb_build_object('profiles',rows,'count',total,'page',page);
end; $$;
revoke all on function public.business_users(integer,text,uuid,text) from public,anon;
grant execute on function public.business_users(integer,text,uuid,text) to authenticated;

create function public.update_business_member(p_user_id uuid,p_changes jsonb) returns void
language plpgsql security definer set search_path=''
as $$
declare business uuid:=public.current_business_id(); target public.business_memberships%rowtype; identity public.profiles%rowtype;
 member_role text:=p_changes->>'role'; member_status text:=p_changes->>'status'; branch uuid; name_value text; phone_value text;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'An active business admin is required'; end if;
 perform 1 from public.businesses where id=business for update;
 if jsonb_typeof(p_changes) is distinct from 'object' or not p_changes ?& array['full_name','phone','role','status','location_id']
 or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('full_name','phone','role','status','location_id')) then raise exception 'Invalid member details'; end if;
 name_value=trim(p_changes->>'full_name'); phone_value=nullif(trim(p_changes->>'phone'),'');
 if jsonb_typeof(p_changes->'full_name') is distinct from 'string' or jsonb_typeof(p_changes->'phone') not in ('string','null')
 or name_value is null or length(name_value) not between 1 and 200 or length(coalesce(phone_value,''))>40
 or member_role not in ('CENTRAL_ADMIN','BRANCH_MANAGER','BRANCH_EMPLOYEE') or member_status not in ('active','pending','disabled')
 or member_role is null or member_status is null then raise exception 'Check member details'; end if;
 if nullif(p_changes->>'location_id','') is not null then
   if p_changes->>'location_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Choose a valid branch'; end if;
   branch=(p_changes->>'location_id')::uuid;
 end if;
 if member_role='CENTRAL_ADMIN' then branch=null;
 elsif branch is null or not exists(select 1 from public.locations where id=branch and business_id=business and is_central is not true) then raise exception 'Choose a branch in this business'; end if;
 select * into target from public.business_memberships where business_id=business and user_id=p_user_id for update;
 if not found then raise exception 'Member not found'; end if;
 if target.role::text='CENTRAL_ADMIN' and target.status::text='active' and (member_role<>'CENTRAL_ADMIN' or member_status<>'active')
 and (select count(*) from public.business_memberships m join public.profiles p on p.id=m.user_id where m.business_id=business and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and p.status::text='active')<=1
 then raise exception 'Keep at least one active business admin'; end if;
 select * into identity from public.profiles where id=p_user_id for update;
 if (coalesce(identity.full_name,'')<>name_value or nullif(trim(identity.phone),'') is distinct from phone_value)
 and (select count(*) from public.business_memberships where user_id=p_user_id)>1 and p_user_id<>auth.uid()
 then raise exception 'Shared account identity must be updated by its owner. Role and branch can still be changed'; end if;
 update public.profiles set full_name=name_value,phone=phone_value,updated_at=clock_timestamp() where id=p_user_id;
 update public.business_memberships set role=member_role::public.user_role,status=member_status::public.profile_status,location_id=branch,updated_at=clock_timestamp()
 where business_id=business and user_id=p_user_id;
end; $$;
revoke all on function public.update_business_member(uuid,jsonb) from public,anon;
grant execute on function public.update_business_member(uuid,jsonb) to authenticated;

create function public.remove_business_member(p_user_id uuid) returns boolean
language plpgsql security definer set search_path=''
as $$
declare business uuid:=public.current_business_id(); target public.business_memberships%rowtype;
begin
 if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'An active business admin is required'; end if;
 if p_user_id=auth.uid() then raise exception 'You cannot remove your own access'; end if;
 perform 1 from public.businesses where id=business for update;
 select * into target from public.business_memberships where business_id=business and user_id=p_user_id for update;
 if not found then return false; end if;
 if target.role::text='CENTRAL_ADMIN' and target.status::text='active'
 and (select count(*) from public.business_memberships m join public.profiles p on p.id=m.user_id where m.business_id=business and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and p.status::text='active')<=1
 then raise exception 'Keep at least one active business admin'; end if;
 delete from public.business_memberships where business_id=business and user_id=p_user_id;
 return found;
end; $$;
revoke all on function public.remove_business_member(uuid) from public,anon;
grant execute on function public.remove_business_member(uuid) to authenticated;

create function public.assign_new_business_user(p_business_id uuid,p_actor_id uuid,p_user_id uuid,p_name text,p_role text,p_location_id uuid) returns boolean
language plpgsql security definer set search_path=''
as $$ begin
 perform 1 from public.businesses where id=p_business_id and status='active' and isolation_ready for update;
 if not found or not exists(select 1 from public.business_memberships m join public.profiles p on p.id=m.user_id
 where m.business_id=p_business_id and m.user_id=p_actor_id and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and p.status::text='active') then return false; end if;
 if p_role not in ('BRANCH_MANAGER','BRANCH_EMPLOYEE') or p_role is null or p_name is null or length(trim(p_name)) not between 1 and 200
 or not exists(select 1 from public.locations where id=p_location_id and business_id=p_business_id and is_central is not true) then return false; end if;
 perform 1 from public.profiles where id=p_user_id and status::text='pending' for update;
 if not found or exists(select 1 from public.business_memberships where user_id=p_user_id) then return false; end if;
 update public.profiles set full_name=trim(p_name),status='active',updated_at=clock_timestamp() where id=p_user_id;
 insert into public.business_memberships(business_id,user_id,role,status,location_id) values(p_business_id,p_user_id,p_role::public.user_role,'active',p_location_id);
 -- Service-only assignment records the verified actor explicitly; the trigger has no user JWT here.
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,next_value)
 values(p_actor_id,'business_user_assignment',p_business_id::text||'/'||p_user_id::text,'INSERT',jsonb_build_object('business_id',p_business_id,'user_id',p_user_id,'role',p_role,'location_id',p_location_id));
 return true;
end; $$;
revoke all on function public.assign_new_business_user(uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.assign_new_business_user(uuid,uuid,uuid,text,text,uuid) to service_role;

-- Global identity must not remain an alternate path for changing another
-- business's roles or disabling a shared login through the direct Data API.
create or replace function public.guard_profile_access() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon','ahaa_operations') then
   if tg_op='INSERT' then raise exception 'Use business member management'; end if;
   if new.id is distinct from old.id or new.role is distinct from old.role or new.status is distinct from old.status
   or new.location_id is distinct from old.location_id or new.email is distinct from old.email then raise exception 'Use business member management'; end if;
   if old.id<>auth.uid() then raise exception 'Use business member management'; end if;
 end if;
 return new;
end; $$;

-- Existing Ahaa is the only tenant enabled by this release set. Other businesses
-- stay provisioning until isolated onboarding has been separately verified.
update public.businesses set isolation_ready=true,updated_at=clock_timestamp() where slug='ahaa';

commit;
