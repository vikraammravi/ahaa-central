import fs from "node:fs/promises";

// Generate a transaction for manual staging execution; never connect to a database.
const migration = (await fs.readFile("supabase/planned/business_isolation.draft.sql", "utf8"))
  .replace(/^begin;\r?\n/m, "").replace(/^commit;\s*$/m, "");
const assertions = (await fs.readFile("supabase/planned/business_isolation.tests.draft.sql", "utf8"))
  .replace(/^begin;\r?\n/m, "").replace(/^rollback;\s*$/m, "");
const membershipMigration = (await fs.readFile("supabase/planned/workspace_memberships.draft.sql", "utf8"))
  .replace(/^begin;\r?\n/m, "").replace(/^commit;\s*$/m, "");
const membershipAssertions = (await fs.readFile("supabase/planned/workspace_memberships.tests.draft.sql", "utf8"))
  .replace(/^begin;\r?\n/m, "").replace(/^rollback;\s*$/m, "");
const regression = (await fs.readFile("supabase/tests/operations_refactor.sql", "utf8"))
  .replace(/^begin;\r?\n/m, "").replace(/^rollback;\s*$/m, "");
const baseline = `
create temp table migration_baseline(table_name text, checksum text);
do $$ declare n text; hash text; begin
 foreach n in array array['locations','catalog_categories','catalog_units','catalog_items','orders','order_lines',
 'pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','weekly_invoices',
 'weekly_invoice_publications','invoice_edits','catering_events','purchase_receipts'] loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,''[]'')) from public.%I t',n) into hash;
 insert into migration_baseline values(n,hash);
 end loop;
end; $$;`;
const unchanged = `
do $$ declare r record; hash text; begin
 for r in select * from migration_baseline loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t)-''business_id'' order by id)::text,''[]'')) from public.%I t',r.table_name) into hash;
 if hash<>r.checksum then raise exception 'Operational data changed during migration: %',r.table_name; end if;
 end loop;
end; $$;`;
const selectAhaa = "select set_config('request.headers',jsonb_build_object('x-business-id',(select id from public.businesses where slug='ahaa'))::text,true);";
await fs.mkdir(".local-backups/saas", { recursive: true });
await fs.writeFile(".local-backups/saas/isolation-rehearsal.sql", [
  "-- STAGING ONLY. Entire migration, privilege changes and fixtures roll back.",
  "begin;", baseline, migration, membershipMigration, unchanged, assertions, membershipAssertions, selectAhaa, regression, "rollback;",
].join("\n"));
console.log("Prepared .local-backups/saas/isolation-rehearsal.sql (rollback-only; no database connection).");
