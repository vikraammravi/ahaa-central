-- Run after isolation fixtures inside the combined rollback-only rehearsal.
begin;
select set_config('request.jwt.claim.sub',(select admin_id::text from isolation_fixture),true);
set local role authenticated;
do $$
declare registered jsonb; unique_slug text := 'platform-test-'||replace(gen_random_uuid()::text,'-',''); owner_email text; owner_id uuid; created_business_id uuid;
begin
 registered=public.platform_create_business('Platform test customer',unique_slug);
 if registered->>'status'<>'provisioning' or (registered->>'isolation_ready')::boolean then raise exception 'Business activated before onboarding'; end if;
 if not exists(select 1 from public.platform_audit_log where entity_type='businesses' and entity_id=registered->>'id' and operation='INSERT' and actor_id=auth.uid()) then raise exception 'Registration audit missing'; end if;
 if exists(select 1 from public.business_memberships where business_id=(registered->>'id')::uuid) then raise exception 'Registration assigned unexpected memberships'; end if;
 created_business_id=(registered->>'id')::uuid;
 if not public.platform_can_create_owner(created_business_id) then raise exception 'New owner preflight failed'; end if;
 select f.manager_id,p.email into owner_id,owner_email from isolation_fixture f join public.profiles p on p.id=f.manager_id;
 begin perform public.platform_assign_initial_owner(created_business_id,'missing@example.invalid'); raise exception 'Missing owner accepted';
 exception when no_data_found then null; end;
 perform public.platform_assign_initial_owner(created_business_id,owner_email);
 if public.platform_can_create_owner(created_business_id) then raise exception 'New owner preflight accepted an assigned business'; end if;
 if not exists(select 1 from public.business_memberships m where m.business_id=created_business_id and m.user_id=owner_id and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and m.location_id is null) then raise exception 'Initial owner not assigned'; end if;
 if not exists(select 1 from public.business_memberships m join isolation_fixture f on f.manager_id=m.user_id and f.business_a=m.business_id where m.user_id=owner_id and m.role::text='BRANCH_MANAGER' and m.status::text='active' and m.location_id=f.branch_a) then raise exception 'Existing business membership changed'; end if;
 if not exists(select 1 from public.platform_audit_log where entity_type='business_memberships' and entity_id=created_business_id::text||'/'||owner_id::text and actor_id=auth.uid()) then raise exception 'Owner assignment audit missing'; end if;
 if exists(select 1 from public.businesses where id=created_business_id and (status<>'provisioning' or isolation_ready)) then raise exception 'Owner assignment activated the business'; end if;
 begin perform public.platform_assign_initial_owner(created_business_id,owner_email); raise exception 'Second owner accepted';
 exception when unique_violation then null; end;
 begin perform public.platform_create_business('Duplicate',unique_slug); raise exception 'Duplicate accepted';
 exception when unique_violation then null; end;
 begin perform public.platform_create_business('Invalid','../admin'); raise exception 'Invalid slug accepted';
 exception when invalid_parameter_value then null; end;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',(select manager_id::text from isolation_fixture),true);
set local role authenticated;
do $$ begin
 begin perform public.platform_create_business('Unauthorized','unauthorized-business'); raise exception 'Manager registered a business';
 exception when insufficient_privilege then null; end;
 begin perform public.platform_assign_initial_owner(gen_random_uuid(),'test@example.invalid'); raise exception 'Manager assigned an owner';
 exception when insufficient_privilege then null; end;
 begin perform public.platform_can_create_owner(gen_random_uuid()); raise exception 'Manager checked owner setup';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.platform_create_business(text,text)','EXECUTE') or has_function_privilege('anon','public.platform_assign_initial_owner(uuid,text)','EXECUTE') then raise exception 'Anonymous platform provisioning enabled'; end if;
 if has_function_privilege('anon','public.platform_assign_new_owner(uuid,uuid,uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.platform_assign_new_owner(uuid,uuid,uuid,text)','EXECUTE') or not has_function_privilege('service_role','public.platform_assign_new_owner(uuid,uuid,uuid,text)','EXECUTE') then raise exception 'New owner assignment is not service-only'; end if;
end; $$;
do $$
declare target uuid:=gen_random_uuid(); other_target uuid:=gen_random_uuid(); customer uuid; actor uuid; outsider uuid;
begin
 select admin_id,manager_id into actor,outsider from isolation_fixture;
 insert into public.businesses(name,slug,status,isolation_ready) values('New owner fixture','owner-'||replace(gen_random_uuid()::text,'-',''),'provisioning',false) returning id into customer;
 insert into auth.users(id,email,raw_user_meta_data) values(target,'owner-'||target::text||'@example.invalid','{}'),(other_target,'owner-'||other_target::text||'@example.invalid','{}');
 if public.platform_assign_new_owner(customer,outsider,target,'Owner') then raise exception 'Non-platform actor assigned a new owner'; end if;
 if not public.platform_assign_new_owner(customer,actor,target,'Owner') then raise exception 'New owner assignment failed'; end if;
 if not exists(select 1 from public.business_memberships where business_id=customer and user_id=target and role::text='CENTRAL_ADMIN' and status::text='active') then raise exception 'New owner membership missing'; end if;
 if not exists(select 1 from public.platform_audit_log where entity_type='new_business_owner' and actor_id=actor and entity_id=customer::text||'/'||target::text) then raise exception 'New owner audit missing'; end if;
 if public.platform_assign_new_owner(customer,actor,other_target,'Other') then raise exception 'Second new owner accepted'; end if;
 if exists(select 1 from public.businesses where id=customer and (status<>'provisioning' or isolation_ready)) then raise exception 'New owner assignment activated business'; end if;
end; $$;
select 'PASS: platform registration permission, audit, uniqueness and provisioning-only state' as result;
rollback;
