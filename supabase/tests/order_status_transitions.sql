-- Rollback-only checks for 202611200001_order_status_transitions.sql.
-- All rows and stock changes are rolled back. Explicit negative order numbers
-- avoid advancing the order-number sequence.
begin;
select set_config('request.jwt.claim.sub', (
  select id::text from public.profiles
  where role::text = 'CENTRAL_ADMIN' and status::text = 'active' limit 1
), true);

-- Fixtures created as the migration owner (client guards do not apply).
do $$
declare
  location uuid;
  product uuid;
  completed_order uuid;
begin
  select id into location from public.locations where not is_central limit 1;
  if location is null or auth.uid() is null then
    raise exception 'An active admin and branch location are required for testing.';
  end if;
  insert into public.catalog_items (name, category, unit_type, default_price, available_stock, low_stock_threshold)
  values ('Status test (rolled back)', (select name from public.catalog_categories where is_active order by name limit 1), (select name from public.catalog_units where is_active order by name limit 1), 1, 100, 3) returning id into product;
  insert into public.orders (location_id, order_number) values (location, -2147483640) returning id into completed_order;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
  values (completed_order, product, 2, 2, 1, false, 2);
  update public.orders set status = 'PREPARING' where id = completed_order;
  update public.orders set status = 'READY' where id = completed_order;
  update public.orders set status = 'COMPLETED', pickup_date = current_date where id = completed_order;
  perform set_config('ahaa_test.location', location::text, true);
  perform set_config('ahaa_test.product', product::text, true);
  perform set_config('ahaa_test.completed_order', completed_order::text, true);
end;
$$;

set local role authenticated;
do $$
declare
  location uuid := current_setting('ahaa_test.location')::uuid;
  product uuid := current_setting('ahaa_test.product')::uuid;
  completed_order uuid := current_setting('ahaa_test.completed_order')::uuid;
  ready_order uuid;
  cancelled_order uuid;
  preparing_order uuid;
  stock integer;
  failed boolean;
  target uuid;
  attempt text;
begin
  -- Allowed forward path and stock deduction still work.
  insert into public.orders (location_id, order_number) values (location, -2147483639) returning id into ready_order;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
  values (ready_order, product, 5, 5, 1, false, 5);
  update public.orders set status = 'PREPARING' where id = ready_order;
  update public.orders set status = 'READY' where id = ready_order;
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 93 then raise exception 'Ready must still deduct stock once (expected 93, got %)', stock; end if;

  -- Allowed cancellations before stock deduction.
  insert into public.orders (location_id, order_number) values (location, -2147483638) returning id into cancelled_order;
  update public.orders set status = 'CANCELLED' where id = cancelled_order;
  insert into public.orders (location_id, order_number) values (location, -2147483637) returning id into preparing_order;
  update public.orders set status = 'PREPARING' where id = preparing_order;
  update public.orders set status = 'CANCELLED' where id = preparing_order;
  insert into public.orders (location_id, order_number) values (location, -2147483636) returning id into preparing_order;
  update public.orders set status = 'PREPARING' where id = preparing_order;

  -- Rejected transitions: each must fail and leave the status unchanged.
  for target, attempt in values
    (ready_order, 'CANCELLED'),
    (ready_order, 'PREPARING'),
    (ready_order, 'SUBMITTED'),
    (completed_order, 'READY'),
    (completed_order, 'CANCELLED'),
    (cancelled_order, 'SUBMITTED'),
    (cancelled_order, 'PREPARING'),
    (cancelled_order, 'READY'),
    (preparing_order, 'SUBMITTED')
  loop
    failed := false;
    begin
      update public.orders set status = attempt::public.order_status where id = target;
    exception when raise_exception then failed := true;
    end;
    if not failed then raise exception 'Transition to % was allowed for order %', attempt, target; end if;
  end loop;

  -- Skipping Preparing is rejected.
  insert into public.orders (location_id, order_number) values (location, -2147483635) returning id into target;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
  values (target, product, 1, 1, 1, false, 1);
  failed := false;
  begin
    update public.orders set status = 'READY' where id = target;
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Submitted order skipped Preparing'; end if;

  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 93 then raise exception 'Rejected transitions changed stock (expected 93, got %)', stock; end if;
  if not exists (select 1 from public.orders where id = ready_order and status::text = 'READY') then raise exception 'Ready order status changed'; end if;
  if not exists (select 1 from public.orders where id = completed_order and status::text = 'COMPLETED') then raise exception 'Completed order status changed'; end if;
  if not exists (select 1 from public.orders where id = cancelled_order and status::text = 'CANCELLED') then raise exception 'Cancelled order status changed'; end if;
end;
$$;
rollback;
