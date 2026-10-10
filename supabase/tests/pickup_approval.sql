-- Rollback-only integration checks under the actual authenticated API role.
-- No order-number sequence is advanced and no test data is retained.
begin;
do $$
declare
  admin_id uuid; branch_id uuid; branch_location uuid;
  product uuid; target_order uuid; target_line uuid; request_id uuid;
  prepared integer; actual integer; expected_stock integer; stock integer;
  result text; failed boolean; scenario integer; invoice numeric;
begin
  select id into admin_id from public.profiles where role::text = 'CENTRAL_ADMIN' and status::text = 'active' limit 1;
  select id, location_id into branch_id, branch_location from public.profiles
    where role::text = 'BRANCH_MANAGER' and status::text = 'active' and location_id is not null limit 1;
  if admin_id is null or branch_id is null then raise exception 'An active admin and assigned branch manager are required.'; end if;

  for scenario in 1..5 loop
    execute 'set local role postgres';
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    prepared := case when scenario in (2, 3) then 5 else 3 end;
    actual := case when scenario in (2, 3) then 3 when scenario = 4 then 4 else 5 end;
    insert into public.catalog_items (name, category, unit_type, default_price, available_stock)
      values ('Pickup test (rolled back)', 'Pantry', 'Box', 2, 100) returning id into product;
    insert into public.orders (location_id, order_number) values (branch_location, -2147483600 + scenario) returning id into target_order;
    insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
      values (target_order, product, 5, prepared, 2, true, 10) returning id into target_line;
    execute 'set local role authenticated';
    update public.orders set status = 'READY' where id = target_order;

    perform set_config('request.jwt.claim.sub', branch_id::text, true);
    failed := false;
    begin
      update public.order_lines set fulfilled_quantity = actual where id = target_line;
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Direct branch quantity changes bypassed approval'; end if;
    failed := false;
    begin
      update public.orders set status = 'COMPLETED' where id = target_order;
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Direct completion bypassed approval'; end if;
    failed := false;
    begin
      perform public.submit_pickup(target_order, jsonb_build_array(jsonb_build_object('line_id', target_line, 'quantity', 1.5)), 'Invalid quantity test');
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Fractional pickup was accepted'; end if;
    result := public.submit_pickup(target_order, jsonb_build_array(jsonb_build_object('line_id', target_line, 'quantity', actual)), 'Pickup quantity changed');
    if result <> 'PENDING' then raise exception 'Changed pickup did not request approval'; end if;
    select id into request_id from public.pickup_requests where order_id = target_order and status = 'PENDING';
    if request_id is null then raise exception 'Branch could not read its pickup request'; end if;
    if not exists (select 1 from public.orders where id = target_order and status = 'READY') then raise exception 'Pending request changed order status'; end if;
    select available_stock into stock from public.catalog_items where id = product;
    if stock <> 100 - prepared then raise exception 'Request changed stock before approval'; end if;
    failed := false;
    begin perform public.review_pickup(request_id, true, '', '{}');
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Branch approved its own pickup request'; end if;
    failed := false;
    begin perform public.submit_pickup(target_order, jsonb_build_array(jsonb_build_object('line_id', target_line, 'quantity', actual)), 'Duplicate');
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Duplicate pending request accepted'; end if;

    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    if scenario = 4 then
      result := public.review_pickup(request_id, false, 'Extra items unavailable', '{}');
      if result <> 'REJECTED' then raise exception 'Rejection failed'; end if;
      if not exists (select 1 from public.orders where id = target_order and status = 'READY') then raise exception 'Rejection did not leave Ready'; end if;
      perform set_config('request.jwt.claim.sub', branch_id::text, true);
      result := public.submit_pickup(target_order, jsonb_build_array(jsonb_build_object('line_id', target_line, 'quantity', prepared)), '');
      if result <> 'COMPLETED' then raise exception 'Matching pickup did not complete immediately'; end if;
      expected_stock := 100 - prepared;
      actual := prepared;
    elsif scenario = 5 then
      update public.catalog_items set available_stock = 0 where id = product;
      failed := false;
      begin perform public.review_pickup(request_id, true, 'Extra pickup', '{}');
      exception when raise_exception then failed := true;
      end;
      if not failed then raise exception 'Extra pickup approved with insufficient stock'; end if;
      if not exists (select 1 from public.pickup_requests where id = request_id and status = 'PENDING') then raise exception 'Failed approval changed request'; end if;
      if not exists (select 1 from public.orders where id = target_order and status = 'READY') then raise exception 'Failed approval completed order'; end if;
      if not exists (select 1 from public.order_lines where id = target_line and fulfilled_quantity = prepared) then raise exception 'Failed approval changed invoice quantities'; end if;
      select available_stock into stock from public.catalog_items where id = product;
      if stock <> 0 then raise exception 'Failed approval changed stock'; end if;
      continue;
    else
      if scenario in (2, 3) then
        failed := false;
        begin perform public.review_pickup(request_id, true, '', '{}');
        exception when raise_exception then failed := true;
        end;
        if not failed then raise exception 'Reduced pickup approved without a return decision'; end if;
      end if;
      result := public.review_pickup(request_id, true, 'Approved at collection',
        case when scenario in (2, 3) then jsonb_build_object(target_line::text, scenario = 2) else '{}'::jsonb end);
      if result <> 'APPROVED' then raise exception 'Approval failed'; end if;
      expected_stock := case when scenario = 3 then 100 - prepared else 100 - actual end;
      failed := false;
      begin perform public.review_pickup(request_id, true, 'Duplicate approval', '{}');
      exception when raise_exception then failed := true;
      end;
      if not failed then raise exception 'Duplicate approval accepted'; end if;
      if not exists (select 1 from public.pickup_requests where id = request_id and reviewed_by = admin_id and review_note = 'Approved at collection') then
        raise exception 'Approver audit was not recorded';
      end if;
    end if;
    select available_stock into stock from public.catalog_items where id = product;
    if stock <> expected_stock then raise exception 'Wrong stock in scenario %: expected %, actual %', scenario, expected_stock, stock; end if;
    select final_total_amount into invoice from public.orders where id = target_order and status = 'COMPLETED';
    if invoice is null or invoice <> actual * 2 * 1.13 then raise exception 'Invoice did not match actual pickup in scenario %', scenario; end if;
  end loop;
  execute 'set local role postgres';
end;
$$;
rollback;
select 'Passed: extra pickup, usable returns, wasted leftovers, rejection and resubmission, immediate matching pickup, stock and tax totals, insufficient stock rollback, audit, duplicate protection, role permissions, and direct-write protection.' as result;
