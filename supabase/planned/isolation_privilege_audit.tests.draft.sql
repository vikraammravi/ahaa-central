-- Rollback-only assertions for the combined staging rehearsal.
begin;
do $$
declare table_name text; function_name text;
begin
 if not exists(select 1 from storage.buckets where id='purchase-receipts' and public=false) then
   raise exception 'Receipt bucket is missing or public';
 end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='storage' and c.relname='objects' and c.relrowsecurity) then
   raise exception 'Storage object row security is disabled';
 end if;
 foreach table_name in array array['locations','catalog_categories','catalog_units','catalog_items','orders','order_lines',
 'pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','weekly_invoices',
 'weekly_invoice_publications','invoice_edits','catering_events','purchase_receipts'] loop
   if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then
     raise exception 'RLS disabled on %',table_name;
   end if;
   if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=table_name
     and p.policyname='business_boundary' and p.permissive='RESTRICTIVE' and p.cmd='ALL'
     and p.roles @> array['authenticated','ahaa_operations']::name[]) then
     raise exception 'Restrictive business boundary missing on %',table_name;
   end if;
 end loop;
 foreach function_name in array array['admin_branch_stock','admin_dashboard_summary','admin_order_counts','branch_dashboard_summary',
 'branch_inventory_workspace','complete_past_catering_events','create_branch_order','create_weekly_invoice','edit_invoice',
 'edit_submitted_branch_order','guard_catalog_history_delete','inventory_day_state','receive_pickup_return','remove_catalog_item','review_pickup','save_branch_inventory_day',
 'save_daily_stock','save_order_fulfillment','send_weekly_invoice','set_invoice_payment_status','submit_pickup','validate_catalog_options','weekly_invoice_details'] loop
   if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname=function_name and p.prosecdef
     and pg_get_userbyid(p.proowner)='ahaa_operations') then
     raise exception 'Restricted function owner missing for %',function_name;
   end if;
   if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname=function_name and p.prosecdef
     and pg_get_userbyid(p.proowner)<>'ahaa_operations') then
     raise exception 'Unrestricted security-definer overload found for %',function_name;
   end if;
 end loop;
 if exists(select 1 from pg_roles where rolname='ahaa_operations' and (rolcanlogin or rolbypassrls or rolsuper)) then
   raise exception 'Operations role can bypass isolation';
 end if;
 if to_regprocedure('public.deduct_stock_when_order_ready()') is null
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='deduct_stock_when_order_ready' and p.prosecdef) then
   raise exception 'Ready stock trigger is missing or has an unexpected elevated overload';
 end if;
 if not has_schema_privilege('ahaa_operations','app_private','usage') or not has_function_privilege('ahaa_operations','app_private.request_user_id()','execute') then
   raise exception 'Operations role lacks access to the request identity helper';
 end if;
 if has_function_privilege('authenticated','public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text)','execute')
   or has_function_privilege('anon','public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text)','execute')
   or has_function_privilege('authenticated','public.reserve_receipt_scan_for_business(uuid,uuid,uuid)','execute')
   or has_function_privilege('anon','public.reserve_receipt_scan_for_business(uuid,uuid,uuid)','execute')
   or not has_function_privilege('service_role','public.create_purchase_receipt_for_business(uuid,uuid,uuid,text,text,text,text)','execute')
   or not has_function_privilege('service_role','public.reserve_receipt_scan_for_business(uuid,uuid,uuid)','execute') then
   raise exception 'Scoped receipt functions do not have service-only execution';
 end if;
 if has_function_privilege('authenticated','public.create_purchase_receipt(uuid,uuid,text,text,text,text)','execute')
   or has_function_privilege('service_role','public.create_purchase_receipt(uuid,uuid,text,text,text,text)','execute')
   or has_function_privilege('authenticated','public.reserve_receipt_scan(uuid,uuid)','execute')
   or has_function_privilege('service_role','public.reserve_receipt_scan(uuid,uuid)','execute') then
   raise exception 'Legacy unscoped receipt function remains executable';
 end if;
end; $$;
select 'PASS: operational tables require restrictive RLS and privileged functions use the restricted owner' as result;
rollback;
