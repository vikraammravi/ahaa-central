-- One-time, manually approved reset. Never include this in schema migrations.
-- Catalog, daily stock, catering, profiles and locations are preserved.
begin;
lock table public.orders, public.order_lines, public.pickup_requests, public.pickup_request_lines, public.invoice_edits, public.weekly_invoices, public.weekly_invoice_publications in access exclusive mode;
do $$ begin
 if (select count(*) from public.orders) <> 10 or (select count(*) from public.order_lines) <> 46 or (select count(*) from public.pickup_requests) <> 5 or (select count(*) from public.weekly_invoices) <> 1 then
  raise exception 'Records changed since backup. Take a new backup and review the reset scope.';
 end if;
end; $$;
truncate table public.pickup_request_lines, public.pickup_requests, public.invoice_edits, public.order_lines, public.orders, public.weekly_invoice_publications, public.weekly_invoices continue identity;
commit;
