-- Run inside the migration's rollback-only staging rehearsal.
do $$
declare
  business uuid; admin_id uuid; manager_id uuid; branch uuid;
  label text := 'Invoice test ' || gen_random_uuid()::text;
  item uuid := gen_random_uuid(); target uuid := gen_random_uuid(); line uuid := gen_random_uuid();
  other_order uuid := gen_random_uuid(); other_line uuid := gen_random_uuid();
  invoice uuid; stamp timestamptz; failed boolean; details jsonb;
begin
  select id into business from public.businesses where slug='ahaa' and status='active';
  select user_id into admin_id from public.business_memberships where business_id=business and role::text='CENTRAL_ADMIN' and status::text='active' limit 1;
  select user_id,location_id into manager_id,branch from public.business_memberships where business_id=business and role::text='BRANCH_MANAGER' and status::text='active' and location_id is not null limit 1;
  if business is null or admin_id is null or manager_id is null then raise exception 'Missing staging test actors'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform set_config('request.headers',jsonb_build_object('x-business-id',business)::text,true);
  insert into public.catalog_categories(name,business_id) values(label,business);
  insert into public.catalog_units(name,business_id) values(label,business);
  insert into public.catalog_items(id,name,category,unit_type,default_price,is_taxable,available_stock,business_id) values(item,label,label,label,10,false,20,business);
  insert into public.orders(id,order_number,location_id,created_by,business_id) values(target,-2147482900,branch,manager_id,business);
  insert into public.order_lines(id,order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total,business_id) values(line,target,item,2,2,10,false,20,business);
  update public.orders set status='READY' where id=target;
  perform public.submit_pickup(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',2)),'',false);
  insert into public.orders(id,order_number,location_id,created_by,business_id) values(other_order,-2147482899,branch,manager_id,business);
  insert into public.order_lines(id,order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total,business_id) values(other_line,other_order,item,2,2,10,false,20,business);
  update public.orders set status='READY' where id=other_order;
  perform public.submit_pickup(other_order,jsonb_build_array(jsonb_build_object('line_id',other_line,'quantity',2)),'',false);
  execute 'set local role authenticated';
  invoice:=public.create_weekly_invoice(branch,current_date,current_date,array[target,other_order]);
  select updated_at into stamp from public.orders where id=target;
  perform public.edit_invoice(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',1,'is_taxable',true)),'',stamp);
  if not exists(select 1 from public.invoice_edits where order_id=target) then raise exception 'Invoice edit history missing'; end if;
  details:=public.weekly_invoice_details(invoice,true);
  if jsonb_array_length(details->'lines') <> 2
    or not exists(select 1 from jsonb_array_elements(details->'lines') value where (value->>'item_id')::uuid=item
      and (value->>'quantity')::numeric=1 and (value->>'is_taxable')::boolean=true
      and (value->>'subtotal')::numeric=10 and (value->>'tax')::numeric=1.3)
    or not exists(select 1 from jsonb_array_elements(details->'lines') value where (value->>'item_id')::uuid=item
      and (value->>'quantity')::numeric=2 and (value->>'is_taxable')::boolean=false
      and (value->>'subtotal')::numeric=20 and (value->>'tax')::numeric=0) then
    raise exception 'Edited combined invoice line does not reflect quantity and tax';
  end if;
  if jsonb_array_length(details->'orders') <> 2
    or not exists(select 1 from jsonb_array_elements(details->'orders') value where (value->>'id')::uuid=target and (value->>'total')::numeric=11.3)
    or not exists(select 1 from jsonb_array_elements(details->'orders') value where (value->>'id')::uuid=other_order and (value->>'total')::numeric=20)
    or (details->>'subtotal')::numeric is distinct from 30::numeric
    or (details->>'tax')::numeric is distinct from 1.3::numeric
    or (details->>'total')::numeric is distinct from 31.3::numeric then
    raise exception 'Edited combined invoice order and totals are incorrect';
  end if;
  perform set_config('request.jwt.claim.sub',manager_id::text,true);
  failed:=false;
  begin perform public.undo_combined_invoice(invoice); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Branch manager could undo a combined invoice'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.undo_combined_invoice(invoice);
  if exists(select 1 from public.weekly_invoices where id=invoice) or exists(select 1 from public.orders where id in (target,other_order) and weekly_invoice_id is not null) then raise exception 'Undo did not restore individual invoices'; end if;
  invoice:=public.create_weekly_invoice(branch,current_date,current_date,array[target]);
  perform public.set_invoice_payment_status(invoice,'PAID',null);
  select updated_at into stamp from public.orders where id=target;
  perform public.edit_invoice(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',2,'is_taxable',false)),'',stamp);
  failed:=false;
  begin perform public.undo_combined_invoice(invoice); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Paid invoice was undone'; end if;
  select payment_updated_at into stamp from public.weekly_invoices where id=invoice;
  perform public.set_invoice_payment_status(invoice,'UNPAID',stamp);
  perform public.send_weekly_invoice(invoice);
  failed:=false;
  begin perform public.undo_combined_invoice(invoice); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Sent invoice was undone'; end if;
  select updated_at into stamp from public.orders where id=target;
  failed:=false;
  begin perform public.edit_invoice(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',2,'is_taxable',false)),'',stamp); exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Sent invoice was edited'; end if;
  execute 'set local role postgres';
end $$;
