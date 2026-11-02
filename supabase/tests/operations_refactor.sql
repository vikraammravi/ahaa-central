-- STAGING ONLY. All fixtures and stock changes roll back. Explicit order numbers avoid advancing the live sequence.
begin;
do $$
declare admin_id uuid; manager_id uuid; branch uuid; product_a uuid:=gen_random_uuid(); product_b uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); line_a uuid:=gen_random_uuid(); line_b uuid:=gen_random_uuid(); cat text; unit text; denied boolean; summary jsonb; i integer; expected_count integer;
begin
 select id into admin_id from public.profiles where role='CENTRAL_ADMIN' and status='active' limit 1;
 select id,location_id into manager_id,branch from public.profiles where role='BRANCH_MANAGER' and status='active' and location_id is not null limit 1;
 if admin_id is null or manager_id is null then raise exception 'Active staging admin and manager are required.'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 select name into cat from public.catalog_categories where is_active limit 1;
 select name into unit from public.catalog_units where is_active limit 1;
 insert into public.catalog_items(id,name,category,unit_type,default_price,available_stock,is_taxable) values(product_a,'refactor-test-a-'||product_a,cat,unit,10,100,false),(product_b,'refactor-test-b-'||product_b,cat,unit,10,100,false);
 insert into public.orders(id,order_number,location_id,created_by) values(target,-900001,branch,manager_id);
 insert into public.order_lines(id,order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total) values(line_a,target,product_a,5,5,10,false,50),(line_b,target,product_b,5,5,10,false,50);
 perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_a,'quantity',4,'note','prepared','expected_quantity',5,'expected_note',''),jsonb_build_object('line_id',line_b,'quantity',3,'note','','expected_quantity',5,'expected_note','')));
 if (select final_total_amount from public.orders where id=target)<>70 then raise exception 'Batch totals incorrect'; end if;
 denied:=false;
 begin
  perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_a,'quantity',2,'note','','expected_quantity',4,'expected_note','prepared'),jsonb_build_object('line_id',line_b,'quantity',99,'note','','expected_quantity',3,'expected_note','')));
 exception when others then denied:=true; end;
 if not denied or (select fulfilled_quantity from public.order_lines where id=line_a)<>4 or (select final_total_amount from public.orders where id=target)<>70 then raise exception 'Partial fulfillment was committed'; end if;
 denied:=false;
 begin perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_a,'quantity',1,'note','','expected_quantity',5,'expected_note',''))); exception when others then denied:=true; end;
 if not denied or (select fulfilled_quantity from public.order_lines where id=line_a)<>4 then raise exception 'Stale edit overwrote current data'; end if;
 perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_a,'quantity',0,'note','','expected_quantity',4,'expected_note','prepared')));
 if (select fulfilled_quantity from public.order_lines where id=line_a)<>0 then raise exception 'Zero fulfillment not retained'; end if;
 update public.orders set status='READY' where id=target;
 if (select available_stock from public.catalog_items where id=product_b)<>97 then raise exception 'Ready stock deduction changed'; end if;
 denied:=false;
 begin perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_b,'quantity',2,'note','','expected_quantity',3,'expected_note',''))); exception when others then denied:=true; end;
 if not denied then raise exception 'Ready order remained editable'; end if;
 for i in 1..7 loop
  insert into public.orders(order_number,location_id,created_by) values(-900010-i,branch,manager_id);
  insert into public.catering_events(location_id,customer_name,customer_phone,guest_count,event_datetime,total_amount,balance_due) values(branch,'Refactor test '||i,'4165550100',10,now()+interval '1 day',100,100);
 end loop;
 perform set_config('request.jwt.claim.sub',manager_id::text,true);
 summary:=public.branch_dashboard_summary();
 if (summary->'branch'->>'id')::uuid is distinct from branch or jsonb_array_length(summary->'recentOrders')<>5 or jsonb_array_length(summary->'upcomingCatering')<>5 then raise exception 'Dashboard scope or bounds incorrect'; end if;
 select count(*) into expected_count from public.orders where location_id=branch and status::text in ('SUBMITTED','PREPARING');
 if (summary->>'pendingOrders')::integer<>expected_count then raise exception 'Dashboard counted only the recent page'; end if;
 if summary->>'businessDate'<>to_char(now() at time zone 'America/Toronto','YYYY-MM-DD') then raise exception 'Dashboard business timezone mismatch'; end if;
 denied:=false;
 begin perform public.save_order_fulfillment(target,jsonb_build_array(jsonb_build_object('line_id',line_b,'quantity',2,'note','','expected_quantity',3,'expected_note',''))); exception when others then denied:=true; end;
 if not denied then raise exception 'Manager could save central fulfillment'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 denied:=false;begin perform public.branch_dashboard_summary(); exception when others then denied:=true; end;
 if not denied then raise exception 'Admin could use a manager dashboard scope'; end if;
 if has_function_privilege('anon','public.save_order_fulfillment(uuid,jsonb)','EXECUTE') or has_function_privilege('anon','public.branch_dashboard_summary()','EXECUTE') then raise exception 'Anonymous caller granted access'; end if;
end;
$$;
select 'PASS: atomic rollback, stale edits, zero fulfillment, unchanged Ready stock, dashboard counts/bounds/scope and role guards' as result;
rollback;
