begin;
do $$
declare
  admin_id uuid; branch_id uuid; branch_location uuid;
  product uuid; target_order uuid; target_line uuid;
  first_sent timestamptz; second_sent timestamptz; failed boolean;
begin
  select id into admin_id from public.profiles where role::text = 'CENTRAL_ADMIN' and status::text = 'active' limit 1;
  select id, location_id into branch_id, branch_location from public.profiles
    where role::text = 'BRANCH_MANAGER' and status::text = 'active' and location_id is not null limit 1;
  if admin_id is null or branch_id is null then raise exception 'Active admin and branch manager required for testing.'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  insert into public.catalog_items (name, category, unit_type, default_price, available_stock)
    values ('Invoice test (rolled back)', 'Pantry', 'Box', 2, 10) returning id into product;
  insert into public.orders (location_id, order_number) values (branch_location, -2147483500) returning id into target_order;
  insert into public.order_lines (order_id, item_id, quantity, fulfilled_quantity, unit_price, is_taxable, line_total)
    values (target_order, product, 3, 3, 2, true, 6) returning id into target_line;
  execute 'set local role authenticated';
  update public.orders set status = 'READY' where id = target_order;
  failed := false;
  begin perform public.send_invoice_to_branch(target_order);
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Draft invoice was sent before completed pickup'; end if;
  perform set_config('request.jwt.claim.sub', branch_id::text, true);
  perform public.submit_pickup(target_order, jsonb_build_array(jsonb_build_object('line_id', target_line, 'quantity', 3)), '');
  failed := false;
  begin perform public.send_invoice_to_branch(target_order);
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Branch sent an invoice without admin'; end if;
  failed := false;
  begin update public.orders set invoice_sent_at = now(), invoice_sent_by = branch_id where id = target_order;
  exception when raise_exception then failed := true;
  end;
  if not failed then raise exception 'Direct write forged invoice delivery'; end if;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  first_sent := public.send_invoice_to_branch(target_order);
  second_sent := public.send_invoice_to_branch(target_order);
  if first_sent is null or first_sent is distinct from second_sent then raise exception 'Repeated send was not idempotent'; end if;
  if not exists (select 1 from public.orders where id = target_order and invoice_sent_at = first_sent and invoice_sent_by = admin_id and final_total_amount = 6.78) then
    raise exception 'Invoice audit or final amounts were incorrect';
  end if;
  perform set_config('request.jwt.claim.sub', branch_id::text, true);
  if not exists (select 1 from public.orders where id = target_order and invoice_sent_at is not null) then
    raise exception 'Branch could not access the published invoice';
  end if;
  execute 'set local role postgres';
end;
$$;
rollback;
select 'Passed: completed invoice publication, branch access, admin-only sending, draft prevention, send audit, duplicate send protection, and direct-write protection. All test data rolled back.' as result;
