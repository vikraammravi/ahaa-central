-- Run inside a transaction that will roll back.
do $$
declare
 business uuid; admin_id uuid; manager_id uuid; branch uuid;
 label text := 'Preview check ' || gen_random_uuid()::text;
 item uuid := gen_random_uuid(); target uuid := gen_random_uuid(); line uuid := gen_random_uuid();
 expected jsonb; stale jsonb; invoice uuid; denied boolean; stamp timestamptz;
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
 insert into public.orders(id,order_number,location_id,created_by,business_id) values(target,-2147482880,branch,manager_id,business);
 insert into public.order_lines(id,order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total,business_id) values(line,target,item,2,2,10,false,20,business);
 update public.orders set status='READY' where id=target;
 perform public.submit_pickup_with_date(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',2)),'',false,current_date);
 select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at,'order_date',order_date,'final_subtotal',final_subtotal,'final_tax_amount',final_tax_amount,'final_total_amount',final_total_amount)) into expected from public.orders where id=target;
 execute 'set local role authenticated';
 -- Another admin changes quantity and tax after the displayed snapshot.
 stale:=expected;
 select updated_at into stamp from public.orders where id=target;
 perform public.edit_invoice(target,jsonb_build_array(jsonb_build_object('line_id',line,'quantity',1,'is_taxable',true)),'',stamp);
 denied:=false;
 begin perform public.create_weekly_invoice_checked(branch,current_date,current_date,array[target],stale); exception when raise_exception then denied:=true; end;
 if not denied or exists(select 1 from public.orders where id=target and weekly_invoice_id is not null) then raise exception 'Stale preview was accepted'; end if;
 select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at,'order_date',order_date,'final_subtotal',final_subtotal,'final_tax_amount',final_tax_amount,'final_total_amount',final_total_amount)) into expected from public.orders where id=target;
 perform set_config('request.jwt.claim.sub',manager_id::text,true);
 denied:=false;
 begin perform public.create_weekly_invoice_checked(branch,current_date,current_date,array[target],expected); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Manager could combine invoices'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 invoice:=public.create_weekly_invoice_checked(branch,current_date,current_date,array[target],expected);
 if not exists(select 1 from public.orders where id=target and weekly_invoice_id=invoice) then raise exception 'Fresh preview did not combine'; end if;
 execute 'set local role postgres';
end $$;
