begin;
do $$
declare
  admin_id uuid; branch_id uuid; branch_location uuid;
  first_item uuid; second_item uuid; stamp1 timestamptz; stamp2 timestamptz;
  qty1 integer; qty2 integer; updates jsonb; failed boolean;
  target_order uuid; line_id uuid; summary jsonb; before_summary jsonb; counts jsonb; before_counts jsonb;
begin
  select id into admin_id from public.profiles where role::text = 'CENTRAL_ADMIN' and status::text = 'active' limit 1;
  select id, location_id into branch_id, branch_location from public.profiles where role::text = 'BRANCH_MANAGER' and status::text = 'active' and location_id is not null limit 1;
  if admin_id is null or branch_id is null then raise exception 'Active admin and branch manager required.'; end if;
  insert into public.catalog_items (name, category, unit_type, default_price, available_stock) values ('Stock batch test one (rolled back)', 'Pantry', 'Box', 2, 10) returning id into first_item;
  insert into public.catalog_items (name, category, unit_type, default_price, available_stock) values ('Stock batch test two (rolled back)', 'Pantry', 'Box', 2, 20) returning id into second_item;
  if first_item > second_item then select second_item, first_item into first_item, second_item; end if;
  select available_stock, updated_at into qty1, stamp1 from public.catalog_items where id = first_item;
  select available_stock, updated_at into qty2, stamp2 from public.catalog_items where id = second_item;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  execute 'set local role authenticated';
  updates := jsonb_build_array(
    jsonb_build_object('id', first_item, 'available_stock', 30, 'expected_stock', qty1, 'expected_updated_at', stamp1),
    jsonb_build_object('id', second_item, 'available_stock', 40, 'expected_stock', -1, 'expected_updated_at', stamp2));
  failed := false;
  begin perform public.save_daily_stock(updates); exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Stale batch was accepted'; end if;
  if not exists(select 1 from public.catalog_items where id=first_item and available_stock=qty1) then raise exception 'A failed batch partially saved its first item'; end if;
  updates := jsonb_build_array(
    jsonb_build_object('id', first_item, 'available_stock', 30, 'expected_stock', qty1, 'expected_updated_at', stamp1),
    jsonb_build_object('id', second_item, 'available_stock', 40, 'expected_stock', qty2, 'expected_updated_at', stamp2));
  if public.save_daily_stock(updates) <> 2 then raise exception 'Valid stock batch failed'; end if;
  if not exists(select 1 from public.catalog_items where id=first_item and available_stock=30) or not exists(select 1 from public.catalog_items where id=second_item and available_stock=40) then raise exception 'Batch stock values incorrect'; end if;
  failed := false;
  begin perform public.save_daily_stock(updates); exception when raise_exception then failed := true; end;
  if not failed then raise exception 'Repeated stale stock batch accepted'; end if;

  before_summary := public.admin_dashboard_summary();
  before_counts := public.admin_order_counts((now() at time zone 'America/Toronto')::date, (now() at time zone 'America/Toronto')::date, branch_location);
  insert into public.orders(location_id, order_number) values(branch_location, -2147483300) returning id into target_order;
  insert into public.order_lines(order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total) values(target_order,first_item,3,3,2,true,6) returning id into line_id;
  summary := public.admin_dashboard_summary();
  if (summary->>'revenueToday')::numeric <> (before_summary->>'revenueToday')::numeric then raise exception 'Submitted order counted as revenue'; end if;
  update public.orders set status='PREPARING' where id=target_order;
  summary := public.admin_dashboard_summary();
  if (summary->>'revenueToday')::numeric <> (before_summary->>'revenueToday')::numeric then raise exception 'Preparing order counted as revenue'; end if;
  update public.orders set status='READY' where id=target_order;
  perform set_config('request.jwt.claim.sub',branch_id::text,true);
  perform public.submit_pickup(target_order,jsonb_build_array(jsonb_build_object('line_id',line_id,'quantity',3)),'');
  failed := false;
  begin perform public.save_daily_stock(updates); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Branch saved admin stock'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  summary:=public.admin_dashboard_summary();
  if (summary->>'revenueToday')::numeric <> (before_summary->>'revenueToday')::numeric + 6.78 then raise exception 'Completed revenue incorrect'; end if;
  if summary->>'businessDate' <> (now() at time zone 'America/Toronto')::date::text then raise exception 'Dashboard business date is wrong'; end if;
  counts:=public.admin_order_counts((now() at time zone 'America/Toronto')::date,(now() at time zone 'America/Toronto')::date,branch_location);
  if (counts->>'ALL')::integer <> (before_counts->>'ALL')::integer + 1 then raise exception 'Server-side branch/date counts incorrect'; end if;
  update public.orders set status='CANCELLED' where id=target_order;
  summary:=public.admin_dashboard_summary();
  if (summary->>'revenueToday')::numeric <> (before_summary->>'revenueToday')::numeric then raise exception 'Cancelled order counted as revenue'; end if;

  execute 'set local role postgres';
  update public.profiles set status='disabled' where id=admin_id;
  execute 'set local role authenticated';
  if public."current_role"() is not null or public.current_location() is not null then raise exception 'Disabled account retained database role'; end if;
  failed:=false;
  begin perform public.admin_dashboard_summary(); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Disabled admin viewed dashboard'; end if;
  failed:=false;
  begin perform public.save_daily_stock(updates); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Disabled admin saved stock'; end if;
  execute 'set local role postgres';
end;
$$;
rollback;
select 'Passed: atomic stock batch, stale conflict rollback, role permissions, disabled-account database checks, completed-only revenue, business timezone, and server-side branch/date counts. All fixtures rolled back.' as result;
