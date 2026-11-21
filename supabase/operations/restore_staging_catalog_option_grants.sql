-- One-time staging repair (2026-11-20). Staging had lost these column grants
-- that production has and 202610240007_catalog_options.sql defines, so admins
-- could not add, rename or archive catalog categories and units there.
-- Idempotent; RLS and the catalog option triggers still apply. Not for production.
begin;
grant insert(name), update(name,is_active) on public.catalog_categories, public.catalog_units to authenticated;
commit;
