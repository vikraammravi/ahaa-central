-- All test rows and stock changes are rolled back. Explicit order numbers
-- avoid advancing the production order-number sequence.
begin;
select set_config('request.jwt.claim.sub', (
  select id::text from public.profiles
  where role::text = 'CENTRAL_ADMIN' and status::text = 'active' limit 1
), true);
set local role authenticated;
do $$
declare
  location uuid;
  product uuid;
  order_id uuid;
  second_order uuid;
  stock integer;
  failed boolean := false;
begin
  select id into location from public.locations where not is_central limit 1;
  if location is null or auth.uid() is null then
    raise exception 'An active admin and branch location are required for testing.';
  end if;
  insert into public.catalog_items (name, category, unit_type, default_price, available_stock, low_stock_threshold)
  values ('Stock test (rolled back)', 'Pantry', 'Box', 1, 10, 3) returning id into product;
  insert into public.orders (location_id, order_number) values (location, -2147483647) returning id into order_id;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
  values (order_id, product, 5, 3, 1, false, 5);
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 10 then raise exception 'Submitted order changed stock'; end if;
  update public.orders set status = 'PREPARING' where id = order_id;
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 10 then raise exception 'Preparing order changed stock'; end if;
  update public.orders set status = 'READY' where id = order_id;
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 7 then raise exception 'Ready must deduct fulfilled quantity exactly once'; end if;
  update public.orders set status = 'READY' where id = order_id;
  update public.orders set status = 'COMPLETED' where id = order_id;
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 7 then raise exception 'Repeated Ready or Completed deducted twice'; end if;
  begin
    update public.orders set status = 'PREPARING' where id = order_id;
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Prepared order was allowed to reset'; end if;
  insert into public.orders (location_id, order_number) values (location, -2147483646) returning id into second_order;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
  values (second_order, product, 8, 8, 1, false, 8);
  failed := false;
  begin
    update public.orders set status = 'READY' where id = second_order;
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Insufficient stock was accepted'; end if;
  select available_stock into stock from public.catalog_items where id = product;
  if stock <> 7 then raise exception 'Failed Ready changed stock'; end if;
  if not exists (select 1 from public.orders where id = second_order and status = 'SUBMITTED' and stock_deducted_at is null) then
    raise exception 'Failed Ready changed the order status or deduction marker';
  end if;
end;
$$;
rollback;
select 'Passed: Submitted, Preparing, fulfilled deduction on Ready, repeated Ready, completion, reset prevention, insufficient stock rollback, authenticated admin access.' as result;
