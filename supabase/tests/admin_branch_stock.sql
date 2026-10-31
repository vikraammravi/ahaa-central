begin;
do $$
declare actor uuid; first_branch uuid; second_branch uuid; first_count uuid; second_count uuid; product uuid; report jsonb; first_state jsonb; second_state jsonb; row_data jsonb; denied boolean; suffix text:=substr(gen_random_uuid()::text,1,8);
begin
 select id into actor from public.profiles where role::text='CENTRAL_ADMIN' and status::text='active' limit 1;
 if actor is null then raise exception 'An active admin is required.';end if;
 insert into public.locations(name,is_central) values('Branch stock A '||suffix,false) returning id into first_branch;
 insert into public.locations(name,is_central) values('Branch stock B '||suffix,false) returning id into second_branch;
 insert into public.catalog_categories(name) values('Stock category '||suffix);
 insert into public.catalog_units(name) values('Stock unit '||suffix);
 insert into public.catalog_items(name,category,unit_type,default_price,available_stock,is_active) values('Stock test '||suffix,'Stock category '||suffix,'Stock unit '||suffix,1,20,true) returning id into product;
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,flow_version) values(first_branch,(now() at time zone 'America/Toronto')::date,actor,'Test admin',2) returning id into first_count;
 insert into public.branch_inventory_counts(location_id,count_date,submitted_by,submitted_name,flow_version) values(second_branch,(now() at time zone 'America/Toronto')::date,actor,'Test admin',2) returning id into second_count;
 insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,opening_quantity,received_quantity,used_quantity,wasted_quantity,adjustment_quantity)
 values(first_count,product,'Stock test '||suffix,'Stock unit '||suffix,3,7,0,3,1,0),(second_count,product,'Stock test '||suffix,'Stock unit '||suffix,0,4,0,4,0,0);
 first_state:=public.inventory_day_state(first_branch,(now() at time zone 'America/Toronto')::date);
 second_state:=public.inventory_day_state(second_branch,(now() at time zone 'America/Toronto')::date);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 set local role authenticated;
 report:=public.admin_branch_stock(0,'Stock test '||suffix,'',null);
 if report->>'count'<>'1' then raise exception 'Missing product';end if;
 row_data:=report->'rows'->0;
 if row_data->>'central_stock'<>'20' then raise exception 'Incorrect central stock';end if;
 if row_data->'branch_stock'->>first_branch::text<>'3' or row_data->'branch_stock'->>second_branch::text<>'0' then raise exception 'Branch balances were mixed or missing';end if;
 if (row_data->'branch_stock'->>first_branch::text)::numeric is distinct from (select (i->>'quantity')::numeric from jsonb_array_elements(first_state->'items') i where i->>'id'=product::text) then raise exception 'First branch quantity differs from inventory';end if;
 if (row_data->'branch_stock'->>second_branch::text)::numeric is distinct from (select (i->>'quantity')::numeric from jsonb_array_elements(second_state->'items') i where i->>'id'=product::text) then raise exception 'Second branch quantity differs from inventory';end if;
 report:=public.admin_branch_stock(0,'Stock test '||suffix,'',first_branch);
 if jsonb_array_length(report->'branches')<>1 or report->'branches'->0->>'id'<>first_branch::text then raise exception 'Branch filter failed';end if;
 reset role;
 update public.profiles set role='BRANCH_MANAGER',location_id=first_branch where id=actor;
 set local role authenticated;
 denied:=false;begin perform public.admin_branch_stock();exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Branch manager accessed all-branch stock';end if;
 reset role;
end;$$;
rollback;
select 'Admin branch stock passed: matches branch inventory, filters branches and rejects non-admin access; test data rolled back' as result;
