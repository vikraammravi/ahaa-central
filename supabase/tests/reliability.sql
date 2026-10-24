begin;
do $$
declare actor uuid; branch uuid; other uuid; product uuid; request uuid:=gen_random_uuid(); failed_order uuid:=gen_random_uuid(); result jsonb; denied boolean; line_count integer;
begin
 select id into actor from public.profiles where role::text='CENTRAL_ADMIN' and status::text='active' limit 1;
 if actor is null then raise exception 'An active admin is required for rollback-only tests.';end if;
 insert into public.locations(name,is_central) values('Reliability test branch (rolled back)',false) returning id into branch;
 insert into public.locations(name,is_central) values('Other reliability branch (rolled back)',false) returning id into other;
 update public.profiles set role='BRANCH_MANAGER',location_id=branch where id=actor;
 insert into public.catalog_items(name,category,unit_type,default_price,available_stock,is_active,is_taxable,low_stock_threshold)
 values('Reliability test atomic product','Sweet','Bucket',2,50,true,true,20) returning id into product;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 perform public.create_branch_order(request,jsonb_build_array(jsonb_build_object('item_id',product,'quantity',5)));
 perform public.create_branch_order(request,jsonb_build_array(jsonb_build_object('item_id',product,'quantity',5)));
 select count(*) into line_count from public.order_lines where order_id=request;
 if line_count<>1 or not exists(select 1 from public.orders where id=request and location_id=branch and subtotal=10 and tax_amount=1.30 and total_amount=11.30) then raise exception 'Atomic order totals or idempotent retry failed.';end if;
 denied:=false;begin perform public.create_branch_order(failed_order,jsonb_build_array(jsonb_build_object('item_id',product,'quantity',1000)));exception when others then denied:=true;end;
 if not denied or exists(select 1 from public.orders where id=failed_order) then raise exception 'Failed submission left an order behind.';end if;
 if (select available_stock from public.catalog_items where id=product)<>50 then raise exception 'Submitted order deducted stock.';end if;
 result:=public.branch_inventory_workspace();
 if not exists(select 1 from jsonb_array_elements(result->'items') entry where entry->>'id'=product::text and entry->>'category'='Sweet') then raise exception 'Inventory category metadata is missing.';end if;
 perform public.complete_past_catering_events(branch);
 denied:=false;begin perform public.complete_past_catering_events(other);exception when others then denied:=true;end;
 if not denied then raise exception 'Cross-branch maintenance was allowed.';end if;
 execute 'set local role postgres';
 insert into public.catering_events(location_id,customer_name,customer_phone,event_datetime,guest_count,total_amount,advance_paid,balance_due,status)
 values(branch,'Reliability inquiry','4165550100',now()-interval '3 days',10,0,0,0,'INQUIRY'),(branch,'Reliability confirmed','4165550100',now()-interval '3 days',10,0,0,0,'CONFIRMED');
 if not exists(select 1 from public.catering_events where location_id=branch and customer_name='Reliability inquiry' and status::text='INQUIRY') or not exists(select 1 from public.catering_events where location_id=branch and customer_name='Reliability confirmed' and status::text='COMPLETED') then raise exception 'Catering normalization changed an inquiry or missed a confirmed event.';end if;
 update public.profiles set role='CENTRAL_ADMIN',location_id=null where id=actor;
 insert into public.catalog_items(name,category,unit_type,default_price,available_stock,is_active,is_taxable,low_stock_threshold)
 select 'Reliability page test '||lpad(i::text,2,'0'),'Grocery','Bucket',1,5,true,false,20 from generate_series(1,28) i;
 execute 'set local role authenticated';
 result:=public.catalog_page(0,'Reliability page test','','all','ALL','{}');
 if (result->>'count')::integer<>28 or jsonb_array_length(result->'rows')<>25 then raise exception 'Catalog first page is incorrect.';end if;
 result:=public.catalog_page(1,'Reliability page test','','all','ALL','{}');
 if jsonb_array_length(result->'rows')<>3 then raise exception 'Catalog second page is incorrect.';end if;
 result:=public.catalog_page(0,'Reliability test atomic','Desserts','active','out-of-stock',jsonb_build_object(product::text,0));
 if (result->>'count')::integer<>1 then raise exception 'Category normalization or staged stock filters failed.';end if;
 execute 'set local role postgres';
 update public.profiles set role='BRANCH_EMPLOYEE',location_id=branch where id=actor;
 execute 'set local role authenticated';
 denied:=false;begin perform public.create_branch_order(gen_random_uuid(),jsonb_build_array(jsonb_build_object('item_id',product,'quantity',1)));exception when others then denied:=true;end;
 if not denied then raise exception 'Employee created a branch order.';end if;
 execute 'set local role postgres';
end; $$;
rollback;
select 'Atomic orders, catering status, authorization and catalog pagination passed; all test data rolled back' as result;
