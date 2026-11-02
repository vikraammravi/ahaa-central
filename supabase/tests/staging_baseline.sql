-- Staging baseline smoke test. Fixtures are rolled back; no login is provisioned.
begin;
do $$
declare actor uuid:=gen_random_uuid(); result jsonb; denied boolean:=false;
begin
  if (select count(*) from pg_tables where schemaname='public')<>16 then raise exception 'Unexpected application table count'; end if;
  if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'Application table lacks RLS'; end if;
  insert into auth.users(id,email,raw_user_meta_data)
  values(actor,'baseline-test-'||actor::text||'@example.invalid','{"full_name":"Baseline test"}'::jsonb);
  if not exists(select 1 from public.profiles where id=actor and status::text='pending') then raise exception 'Profile creation trigger failed'; end if;
  update public.profiles set role='CENTRAL_ADMIN',status='active' where id=actor;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  if public."current_role"() is distinct from 'CENTRAL_ADMIN' then raise exception 'Active role lookup failed'; end if;
  result:=public.admin_branch_stock();
  if result->'rows' is distinct from '[]'::jsonb then raise exception 'Staging unexpectedly contains catalog data'; end if;
  if has_function_privilege('authenticated','public.inventory_day_state(uuid,date)','execute') then raise exception 'Private stock helper exposed'; end if;
  if has_function_privilege('authenticated','public.reserve_receipt_scan(uuid,uuid)','execute') then raise exception 'Scan limiter exposed'; end if;
  update public.profiles set role='BRANCH_MANAGER' where id=actor;
  begin perform public.admin_branch_stock(); exception when others then
    if sqlerrm like 'Only an active central admin%' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'Branch manager can access central stock overview'; end if;
end;
$$;
select 'Staging baseline, profile trigger and role access checks passed' as result;
rollback;
