-- Run after isolation fixtures inside the combined rollback-only rehearsal.
begin;
select set_config('request.jwt.claim.sub',(select admin_id::text from isolation_fixture),true);
set local role authenticated;
do $$
declare registered jsonb; unique_slug text := 'platform-test-'||replace(gen_random_uuid()::text,'-','');
begin
 registered=public.platform_create_business('Platform test customer',unique_slug);
 if registered->>'status'<>'provisioning' or (registered->>'isolation_ready')::boolean then raise exception 'Business activated before onboarding'; end if;
 if not exists(select 1 from public.platform_audit_log where entity_type='businesses' and entity_id=registered->>'id' and operation='INSERT' and actor_id=auth.uid()) then raise exception 'Registration audit missing'; end if;
 if exists(select 1 from public.business_memberships where business_id=(registered->>'id')::uuid) then raise exception 'Registration assigned unexpected memberships'; end if;
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
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.platform_create_business(text,text)','EXECUTE') then raise exception 'Anonymous business registration enabled'; end if;
end; $$;
select 'PASS: platform registration permission, audit, uniqueness and provisioning-only state' as result;
rollback;
