-- Rollback-only integration test. Run in a disposable/local database with the
-- workspace-isolation package and 202611050001 installed. Not a production task.
begin;
create temp table usage_fixture(business_a uuid,business_b uuid,branch_a uuid,actor uuid);

do $$
declare
 a uuid; b uuid; branch_a uuid; branch_other uuid; branch_b uuid; actor uuid;
 item_a uuid; item_b uuid; count_id uuid; i integer;
begin
 select id into actor from public.profiles where status::text='active' order by id limit 1;
 if actor is null then raise exception 'Need an existing active test identity.'; end if;
 insert into public.businesses(slug,name,status,isolation_ready) values
  ('usage-fixture-a','Usage fixture A','active',true) returning id into a;
 insert into public.businesses(slug,name,status,isolation_ready) values
  ('usage-fixture-b','Usage fixture B','active',true) returning id into b;
 insert into public.locations(name,is_central,business_id) values('Usage branch A',false,a) returning id into branch_a;
 insert into public.locations(name,is_central,business_id) values('Other A branch',false,a) returning id into branch_other;
 insert into public.locations(name,is_central,business_id) values('Usage branch B',false,b) returning id into branch_b;
 insert into public.business_memberships(business_id,user_id,role,status,location_id) values
  (a,actor,'BRANCH_MANAGER','active',branch_a),(b,actor,'BRANCH_EMPLOYEE','active',branch_b);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.headers',jsonb_build_object('x-business-id',a)::text,true);
 insert into public.catalog_categories(name,business_id) values('__usage_test',a),('__usage_test',b);
 insert into public.catalog_units(name,business_id) values('__usage_test',a),('__usage_test',b);
 insert into public.catalog_items(name,category,unit_type,default_price,business_id)
 values('Current catalog name','__usage_test','__usage_test',1,a) returning id into item_a;
 perform set_config('request.headers',jsonb_build_object('x-business-id',b)::text,true);
 insert into public.catalog_items(name,category,unit_type,default_price,business_id)
 values('Foreign item','__usage_test','__usage_test',1,b) returning id into item_b;
 perform set_config('request.headers',jsonb_build_object('x-business-id',a)::text,true);
 for i in 1..26 loop
  insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,submitted_at,business_id)
  values(branch_a,date '2020-01-01'+i-1,actor,'Original employee',timestamptz '2020-02-01 12:00:00+00',a) returning id into count_id;
  insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,used_quantity,business_id)
  values(count_id,item_a,'Historical snapshot name','Historical unit',0,case when i=3 then null else i end,a);
 end loop;
 -- Two updates on one date must remain one daily usage entry, not a sum.
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,submitted_at,business_id)
 values(branch_a,'2020-01-26',actor,'Latest employee','2020-02-02 12:00:00+00',a) returning id into count_id;
 insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,used_quantity,business_id)
 values(count_id,item_a,'Historical snapshot name','Historical unit',0,77,a);
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,business_id)
 values(branch_other,'2020-01-26',actor,'Other branch',a) returning id into count_id;
 insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,used_quantity,business_id)
 values(count_id,item_a,'Other branch snapshot','Unit',0,999,a);
 perform set_config('request.headers',jsonb_build_object('x-business-id',b)::text,true);
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,business_id)
 values(branch_b,'2020-01-26',actor,'Other business',b) returning id into count_id;
 insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,used_quantity,business_id)
 values(count_id,item_b,'Other business snapshot','Unit',0,888,b);
 insert into usage_fixture values(a,b,branch_a,actor);
end; $$;
grant select on usage_fixture to authenticated;

select set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from usage_fixture;
set local role authenticated;
do $$
declare actual jsonb; denied boolean:=false;
begin
 actual:=public.branch_inventory_usage_history();
 if (actual->>'total')::integer<>26 or jsonb_array_length(actual->'rows')<>25 then raise exception 'Incorrect bounded page or duplicate dates.'; end if;
 if actual->'rows'->0->>'used_quantity'<>'77' or actual->'rows'->0->>'submitted_name'<>'Latest employee' then raise exception 'Latest daily correction not selected.'; end if;
 if actual->'rows'->0->>'item_name'<>'Historical snapshot name' or actual->'rows'->0->>'unit_type'<>'Historical unit' then raise exception 'Historical snapshots were replaced by catalog values.'; end if;
 if exists(select 1 from jsonb_array_elements(actual->'rows') x where (x->>'used_quantity')::integer in (999,888)) then raise exception 'Foreign branch/business usage exposed.'; end if;
 actual:=public.branch_inventory_usage_history(null,null,'',1);
 if jsonb_array_length(actual->'rows')<>1 or actual->'rows'->0->>'count_date'<>'2020-01-01' then raise exception 'Second page incorrect.'; end if;
 actual:=public.branch_inventory_usage_history('2020-01-03','2020-01-03','historical',0);
 if (actual->>'total')::integer<>1 or actual->'rows'->0->'used_quantity' is distinct from 'null'::jsonb then raise exception 'Unknown legacy usage was invented.'; end if;
 actual:=public.branch_inventory_usage_history(null,null,'%',0);
 if (actual->>'total')::integer<>0 then raise exception 'Search treated literal text as wildcard.'; end if;
 actual:=public.branch_inventory_usage_history(null,null,'',999);
 if (actual->>'page')::integer<>1 or jsonb_array_length(actual->'rows')<>1 then raise exception 'Out-of-range page was not clamped.'; end if;
 begin perform public.branch_inventory_usage_history('2020-02-01','2020-01-01'); exception when others then denied:=true; end;
 if not denied then raise exception 'Invalid date range accepted.'; end if;
end; $$;
reset role;

-- Same identity has employee access to a different business, never A's data.
select set_config('request.headers',jsonb_build_object('x-business-id',business_b)::text,true) from usage_fixture;
set local role authenticated;
do $$ declare actual jsonb; begin
 actual:=public.branch_inventory_usage_history();
 if (actual->>'total')::integer<>1 or actual->'rows'->0->>'used_quantity'<>'888' then raise exception 'Employee workspace scope failed.'; end if;
end; $$;
reset role;
update public.business_memberships set status='disabled' where (business_id,user_id) in (select business_b,actor from usage_fixture);
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.branch_inventory_usage_history(); exception when others then denied:=true; end;
 if not denied then raise exception 'Disabled membership retained usage access.'; end if;
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.branch_inventory_usage_history(date,date,text,integer)','execute') then raise exception 'Anonymous usage access granted.'; end if;
 if (select prosecdef from pg_proc where oid='public.branch_inventory_usage_history(date,date,text,integer)'::regprocedure) then raise exception 'History must honor invoker RLS.'; end if;
end; $$;
rollback;
select 'Passed: latest daily snapshots, bounded pagination, literal search, legacy unknowns, manager/employee business and branch boundaries, disabled access. All fixtures rolled back.' as result;
