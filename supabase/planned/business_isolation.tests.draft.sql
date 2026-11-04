-- INCOMPLETE DRAFT. NOT VALIDATED. DO NOT APPLY.
-- Requires workspace-aware APIs/UI, scoped receipt functions and full acceptance tests.
-- STAGING ONLY, rollback-only. Run after the isolation migration or in rehearsal.
begin;
create temp table isolation_fixture (business_a uuid,business_b uuid,admin_id uuid,manager_id uuid,outsider_id uuid,branch_a uuid,branch_b uuid,item_a uuid,item_b uuid,order_a uuid,order_b uuid,invoice_a uuid,invoice_b uuid,pickup_b uuid,inventory_b uuid);
do $$
declare a uuid; b uuid; admin_user uuid; manager_user uuid; outsider uuid; branch_a uuid; branch_b uuid:=gen_random_uuid(); item_a uuid:=gen_random_uuid(); item_b uuid:=gen_random_uuid(); order_a uuid:=gen_random_uuid(); order_b uuid:=gen_random_uuid(); invoice_a uuid:=gen_random_uuid(); invoice_b uuid:=gen_random_uuid(); pickup_b uuid:=gen_random_uuid(); inventory_b uuid:=gen_random_uuid();
begin
 select id into strict a from public.businesses where slug='ahaa';
 update public.businesses set isolation_ready=true where id=a;
 select user_id into admin_user from public.platform_administrators where is_active limit 1;
 select id,location_id into manager_user,branch_a from public.profiles where role::text='BRANCH_MANAGER' and status::text='active' and location_id is not null order by id limit 1;
 select id into outsider from public.profiles where id not in (admin_user,manager_user) and status::text='active' order by id limit 1;
 if admin_user is null or manager_user is null or outsider is null then raise exception 'Staging fixture accounts are missing'; end if;
 insert into public.businesses(slug,name,status,isolation_ready) values('isolation-fixture','Isolation fixture','active',true) returning id into b;
 insert into public.locations(id,name,is_central,business_id) values(branch_b,'Isolated branch',false,b);
 insert into public.business_memberships(business_id,user_id,role,status,location_id) values
 (b,admin_user,'BRANCH_MANAGER','active',branch_b),(b,manager_user,'BRANCH_EMPLOYEE','active',branch_b);
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 perform set_config('request.headers',jsonb_build_object('x-business-id',a)::text,true);
 insert into public.catalog_categories(name,business_id) values('__isolation_fixture',a);
 insert into public.catalog_units(name,business_id) values('__isolation_fixture',a);
 insert into public.catalog_items(id,name,category,unit_type,default_price,available_stock,business_id) values(item_a,'A item','__isolation_fixture','__isolation_fixture',10,100,a);
 insert into public.orders(id,order_number,location_id,status,business_id) values(order_a,-2147483001,branch_a,'SUBMITTED',a);
 insert into public.weekly_invoices(id,location_id,start_date,end_date,business_id) values(invoice_a,branch_a,current_date,current_date,a);
 perform set_config('request.headers',jsonb_build_object('x-business-id',b)::text,true);
 insert into public.catalog_categories(name,business_id) values('__isolation_fixture',b);
 insert into public.catalog_units(name,business_id) values('__isolation_fixture',b);
 insert into public.catalog_items(id,name,category,unit_type,default_price,available_stock,business_id) values(item_b,'B item','__isolation_fixture','__isolation_fixture',10,200,b);
 insert into public.orders(id,order_number,location_id,status,business_id) values(order_b,-2147483002,branch_b,'SUBMITTED',b);
 insert into public.weekly_invoices(id,location_id,start_date,end_date,business_id) values(invoice_b,branch_b,current_date,current_date,b);
 insert into public.pickup_requests(id,order_id,reason,business_id) values(pickup_b,order_b,'fixture',b);
 insert into public.branch_inventory_counts(id,location_id,count_date,submitted_name,business_id) values(inventory_b,branch_b,current_date,'Fixture',b);
 insert into public.branch_inventory_lines(count_id,item_id,item_name,unit_type,quantity,business_id) values(inventory_b,item_b,'B item','__isolation_fixture',3,b);
 insert into isolation_fixture values(a,b,admin_user,manager_user,outsider,branch_a,branch_b,item_a,item_b,order_a,order_b,invoice_a,invoice_b,pickup_b,inventory_b);
end; $$;
grant select on isolation_fixture to authenticated;

-- Browser queries and operational definers must share the same business boundary.
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from isolation_fixture;
set local role authenticated;
do $$
declare f isolation_fixture%rowtype; dashboard jsonb; changes integer;
begin
 select * into f from isolation_fixture;
 if public.current_business_id()<>f.business_a or public."current_role"()<>'CENTRAL_ADMIN' then raise exception 'A membership context failed'; end if;
 if public.weekly_invoice_details(f.invoice_a,true) is null then raise exception 'Own invoice could not be read'; end if;
 if exists(select 1 from public.weekly_invoices where id=f.invoice_b) or exists(select 1 from public.pickup_requests where id=f.pickup_b) then raise exception 'Foreign invoice or pickup exposed'; end if;
 if exists(select 1 from public.branch_inventory_counts where id=f.inventory_b) or exists(select 1 from public.branch_inventory_lines where count_id=f.inventory_b) then raise exception 'Foreign branch inventory exposed'; end if;
 begin perform public.weekly_invoice_details(f.invoice_b,true); raise exception 'Foreign invoice details accepted';
 exception when raise_exception then if sqlerrm<>'Invoice not accessible.' then raise; end if; end;
 begin perform public.send_weekly_invoice(f.invoice_b); raise exception 'Foreign invoice send accepted';
 exception when raise_exception then if sqlerrm<>'Weekly invoice not found.' then raise; end if; end;
 begin perform public.set_invoice_payment_status(f.invoice_b,'PAID',null); raise exception 'Foreign invoice payment accepted';
 exception when raise_exception then if sqlerrm<>'Invoice not found.' then raise; end if; end;
 begin perform public.review_pickup(f.pickup_b,true,'','{}'::jsonb); raise exception 'Foreign pickup review accepted';
 exception when raise_exception then if sqlerrm not ilike '%not found%' then raise; end if; end;
 if exists(select 1 from public.catalog_items where business_id<>f.business_a) or exists(select 1 from public.orders where business_id<>f.business_a) then raise exception 'Foreign rows exposed'; end if;
 update public.catalog_items set available_stock=1 where id=f.item_b;
 get diagnostics changes=row_count;
 if changes<>0 then raise exception 'Foreign stock changed'; end if;
 begin
   delete from public.orders where id=f.order_b;
   get diagnostics changes=row_count;
   if changes<>0 then raise exception 'Foreign order deleted'; end if;
 exception when insufficient_privilege then null; end;
 begin
   update public.branch_inventory_lines set quantity=99 where count_id=f.inventory_b;
   get diagnostics changes=row_count;
   if changes<>0 then raise exception 'Foreign inventory changed'; end if;
 exception when insufficient_privilege then null; end;
 begin
   insert into public.catalog_items(name,category,unit_type,default_price,business_id) values('Bad ownership','__isolation_fixture','__isolation_fixture',1,f.business_b);
   raise exception 'Cross-business insert was accepted';
 exception when insufficient_privilege then null; end;
 dashboard=public.admin_dashboard_summary();
 if exists(select 1 from jsonb_array_elements(dashboard->'recentOrders') x where x->>'business_id'<>f.business_a::text) then raise exception 'Dashboard leaked foreign orders'; end if;
 begin
   perform public.save_order_fulfillment(f.order_b,jsonb_build_array(jsonb_build_object('line_id',gen_random_uuid(),'quantity',1,'expected_quantity',1)));
   raise exception 'Foreign fulfillment accepted';
 exception when raise_exception then if sqlerrm='Foreign fulfillment accepted' then raise; end if; end;
 begin
   perform public.remove_catalog_item(f.item_a);
   raise exception 'Own catalog removal succeeded';
 exception when others then
   if sqlerrm<>'Own catalog removal succeeded' then raise exception 'Own catalog removal failed: %',sqlerrm; end if;
 end;
 begin
   perform public.remove_catalog_item(f.item_b);
   raise exception 'Foreign catalog removal accepted';
 exception when others then if sqlerrm='Foreign catalog removal accepted' then raise; end if; end;
 begin
   perform public.edit_invoice(f.order_b,'[]'::jsonb,'cross-business test',null);
   raise exception 'Foreign invoice edit accepted';
 exception when raise_exception then if sqlerrm='Foreign invoice edit accepted' then raise; end if; end;
end; $$;
reset role;

-- The same identity has a different role and location in business B.
select set_config('request.headers',jsonb_build_object('x-business-id',business_b)::text,true) from isolation_fixture;
set local role authenticated;
do $$ declare f isolation_fixture%rowtype; begin
 select * into f from isolation_fixture;
 if not exists(select 1 from public.catalog_items where id=f.item_b and business_id=f.business_b and available_stock=200 and archived_at is null) then
   raise exception 'Foreign catalog item was changed';
 end if;
 if not exists(select 1 from public.orders where id=f.order_b and business_id=f.business_b) then raise exception 'Foreign order was deleted'; end if;
 if not exists(select 1 from public.branch_inventory_lines where count_id=f.inventory_b and quantity=3) then raise exception 'Foreign inventory was changed'; end if;
 if public."current_role"()<>'BRANCH_MANAGER' or public.current_location()<>f.branch_b then raise exception 'Global role/location leaked across memberships'; end if;
 if exists(select 1 from public.catalog_items where business_id<>f.business_b) then raise exception 'B catalog leaked'; end if;
 begin perform public.admin_dashboard_summary(); raise exception 'B manager obtained A admin privileges';
 exception when raise_exception then if sqlerrm='B manager obtained A admin privileges' then raise; end if; end;
end; $$;
reset role;

-- A manager in A is an employee in B: their access follows the selected membership.
select set_config('request.jwt.claim.sub',manager_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_b)::text,true) from isolation_fixture;
set local role authenticated;
do $$ declare f isolation_fixture%rowtype; begin
 select * into f from isolation_fixture;
 if public."current_role"()<>'BRANCH_EMPLOYEE' or public.inventory_location()<>f.branch_b then raise exception 'B employee membership context failed'; end if;
 if not exists(select 1 from public.branch_inventory_counts where id=f.inventory_b) or not exists(select 1 from public.branch_inventory_lines where count_id=f.inventory_b and item_id=f.item_b) then raise exception 'B employee cannot read own inventory'; end if;
 if exists(select 1 from public.branch_inventory_counts where business_id<>f.business_b) or exists(select 1 from public.branch_inventory_lines where business_id<>f.business_b) then raise exception 'A inventory visible to B employee'; end if;
end; $$;
reset role;

-- Cross-business references also fail through a privileged SQL write.
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from isolation_fixture;
do $$ declare f isolation_fixture%rowtype; begin
 select * into f from isolation_fixture;
 begin
   insert into public.order_lines(order_id,item_id,quantity,unit_price,is_taxable,line_total,business_id) values(f.order_a,f.item_b,1,10,false,10,f.business_a);
   raise exception 'Cross-business item reference accepted';
 exception when foreign_key_violation then null; end;
 begin update public.locations set business_id=f.business_a where id=f.branch_b; raise exception 'Ownership move accepted';
 exception when raise_exception then if sqlerrm='Ownership move accepted' then raise; end if; end;
end; $$;

-- Service-only receipt operations enforce business/branch ownership and global scan ceilings.
do $$ begin
 if not exists(select 1 from storage.buckets where id='purchase-receipts' and public=false) then
   raise exception 'Receipt bucket is missing or public';
 end if;
end; $$;
-- Metadata-only objects prove the policy also denies direct reads when records
-- exist. They are synthetic and the surrounding transaction rolls them back.
insert into storage.objects(bucket_id,name)
select 'purchase-receipts',business_a::text||'/isolation-fixture-a/original.pdf' from isolation_fixture
union all
select 'purchase-receipts',business_b::text||'/isolation-fixture-b/original.pdf' from isolation_fixture;
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_a)::text,true) from isolation_fixture;
set local role authenticated;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='purchase-receipts') then
   raise exception 'Authenticated users can directly list private receipt objects';
 end if;
end; $$;
reset role;
do $$
declare f isolation_fixture%rowtype; receipt uuid:=gen_random_uuid(); path text; allowed boolean; month_key text:=to_char(now() at time zone 'UTC','YYYY-MM'); day_key text;
begin
 select * into f from isolation_fixture;
 path=f.business_a::text||'/'||receipt::text||'/original.pdf';
 day_key=f.admin_id::text||':'||to_char(now() at time zone 'America/Toronto','YYYY-MM-DD');
 if has_function_privilege('authenticated','public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text)','EXECUTE')
 or has_function_privilege('anon','public.reserve_receipt_scan_for_business(uuid,uuid,uuid)','EXECUTE') then raise exception 'Public receipt service permission'; end if;
 if not public.create_purchase_receipt_for_business(f.business_a,receipt,f.admin_id,'fixture.pdf',path,repeat('a',64),'prebuilt-invoice') then raise exception 'Authorized scoped upload rejected'; end if;
 if public.reserve_receipt_scan_for_business(f.business_b,receipt,f.admin_id) then raise exception 'Foreign receipt scan reserved'; end if;
 if public.create_purchase_receipt_for_business(f.business_b,gen_random_uuid(),f.outsider_id,'foreign.pdf',path,repeat('b',64),'prebuilt-invoice') then raise exception 'Non-member upload created'; end if;
 if public.create_purchase_receipt_for_business(f.business_a,gen_random_uuid(),f.admin_id,'foreign.pdf',f.business_b::text||'/original.pdf',repeat('b',64),'prebuilt-invoice') then raise exception 'Foreign storage prefix accepted'; end if;
 update public.purchase_receipts set scan_usage=jsonb_build_object(month_key,100) where id=receipt;
 if public.reserve_receipt_scan_for_business(f.business_a,receipt,f.admin_id) then raise exception 'Monthly ceiling bypassed'; end if;
 update public.purchase_receipts set scan_usage=jsonb_build_object(day_key,10) where id=receipt;
 if public.reserve_receipt_scan_for_business(f.business_a,receipt,f.admin_id) then raise exception 'Daily user ceiling bypassed'; end if;
end; $$;

-- Forged, absent/ambiguous, suspended and disabled contexts fail closed.
select set_config('request.jwt.claim.sub',outsider_id::text,true),set_config('request.headers',jsonb_build_object('x-business-id',business_b)::text,true) from isolation_fixture;
set local role authenticated;
do $$ begin
 begin perform public.current_business_id(); raise exception 'Non-member entered workspace';
 exception when raise_exception then if sqlerrm='Non-member entered workspace' then raise; end if; end;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',admin_id::text,true),set_config('request.headers','{}',true) from isolation_fixture;
set local role authenticated;
do $$ begin
 begin perform public.current_business_id(); raise exception 'Ambiguous workspace silently selected';
 exception when raise_exception then if sqlerrm='Ambiguous workspace silently selected' then raise; end if; end;
end; $$;
reset role;
update public.businesses set status='suspended' where id=(select business_b from isolation_fixture);
select set_config('request.headers',jsonb_build_object('x-business-id',business_b)::text,true) from isolation_fixture;
set local role authenticated;
do $$ begin
 begin perform public.current_business_id(); raise exception 'Suspended workspace accepted';
 exception when raise_exception then if sqlerrm='Suspended workspace accepted' then raise; end if; end;
end; $$;
reset role;
update public.businesses set status='active' where id=(select business_b from isolation_fixture);
update public.business_memberships set status='disabled' where business_id=(select business_b from isolation_fixture) and user_id=(select admin_id from isolation_fixture);
set local role authenticated;
do $$ begin
 begin perform public.current_business_id(); raise exception 'Disabled membership accepted';
 exception when raise_exception then if sqlerrm='Disabled membership accepted' then raise; end if; end;
end; $$;
reset role;
select 'PASS: business rows, role/location context, RPC isolation, composite references and revoked access; all fixtures rolled back' as result;
rollback;
