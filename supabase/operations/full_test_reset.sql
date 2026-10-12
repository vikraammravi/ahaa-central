-- One-time reset requested on 2026-10-12. NEVER run as a migration.
-- Backup: .local-backups/full-reset-1791834869990.json (private, ignored by Git).
-- Keep Nagesh Ramagiri, admin@aahatrulysouth.com. Password is unchanged.
-- Final scope retains all five original branch/central location records.
begin;
lock table public.branch_inventory_counts,public.branch_inventory_lines,public.catalog_items,
 public.catering_events,public.invoice_edits,public.locations,public.order_lines,public.orders,
 public.pickup_request_lines,public.pickup_requests,public.profiles,
 public.weekly_invoice_publications,public.weekly_invoices in access exclusive mode;
do $$
begin
 if not exists(select 1 from public.profiles where id='21bf35b6-b5d7-4946-a2b9-94a56ce4119b' and role::text='CENTRAL_ADMIN' and status::text='active' and email='admin@aahatrulysouth.com') then
  raise exception 'The preserved admin does not match. Stop and inspect.';
 end if;
 if (select count(*) from public.profiles)<>3 or (select count(*) from public.orders)<>9
  or (select count(*) from public.order_lines)<>25 or (select count(*) from public.catalog_items)<>28
  or (select count(*) from public.locations)<>5 or (select count(*) from public.catering_events)<>4
  or (select count(*) from public.weekly_invoices)<>3 or (select count(*) from public.weekly_invoice_publications)<>1
  or (select count(*) from public.pickup_requests)<>6 or (select count(*) from public.pickup_request_lines)<>16
  or (select count(*) from public.branch_inventory_counts)<>5 or (select count(*) from public.branch_inventory_lines)<>86
  or (select count(*) from public.invoice_edits)<>0 then
  raise exception 'Records changed since backup. Refresh the backup before resetting.';
 end if;
end $$;
truncate public.branch_inventory_lines,public.branch_inventory_counts,
 public.pickup_request_lines,public.pickup_requests,public.invoice_edits,
 public.order_lines,public.orders,public.weekly_invoice_publications,public.weekly_invoices,
 public.catering_events,public.catalog_items restart identity;
delete from public.profiles where id<>'21bf35b6-b5d7-4946-a2b9-94a56ce4119b';
update public.profiles set location_id=null where id='21bf35b6-b5d7-4946-a2b9-94a56ce4119b';
commit;
-- Then delete only the two non-admin Auth accounts with the Admin API.
