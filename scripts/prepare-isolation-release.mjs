import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Preparation only: no database connection, deployment or environment mutation.
const args = process.argv.slice(2);
const allowed = /^(--target=(staging|production)|--mode=(rehearsal|release))$/;
if (args.some(arg => !allowed.test(arg)) || args.filter(arg => arg.startsWith("--target=")).length !== 1 || args.filter(arg => arg.startsWith("--mode=")).length > 1) {
  throw new Error("Use --target=staging|production [--mode=rehearsal|release]. This command only prepares SQL.");
}
const target = args.find(arg => arg.startsWith("--target=")).split("=")[1];
const mode = args.find(arg => arg.startsWith("--mode="))?.split("=")[1] ?? "rehearsal";
const sourceHashes = {};
async function transactionBody(filename, ending) {
  const source = await fs.readFile(filename, "utf8");
  sourceHashes[filename] = createHash("sha256").update(source).digest("hex");
  if (!/^begin;\s*$/m.test(source) || !new RegExp(`^${ending};\\s*$`, "m").test(source)) throw new Error(`Unexpected transaction wrapper: ${filename}`);
  const body = source.replace(/^begin;\s*$/m, "").replace(new RegExp(`^${ending};\\s*$`, "m"), "");
  if (/^\s*(begin|commit|rollback);\s*$/im.test(body)) throw new Error(`Nested transaction command: ${filename}`);
  return body;
}
const tables = ["locations", "catalog_categories", "catalog_units", "catalog_items", "orders", "order_lines", "pickup_requests", "pickup_request_lines", "branch_inventory_counts", "branch_inventory_lines", "weekly_invoices", "weekly_invoice_publications", "invoice_edits", "catering_events", "purchase_receipts"];
const sqlTables = tables.map(name => `'${name}'`).join(",");
const preflight = `
do $$ declare n text; begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='locations' and column_name='business_id')
 then raise exception 'Operational isolation already exists; do not replay this release'; end if;
 foreach n in array array[${sqlTables},'profiles'] loop
 if not exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relname=n and c.relkind='r' and c.relrowsecurity) then raise exception 'Expected baseline table with RLS is missing: %',n; end if;
 end loop;
 if to_regprocedure('public.create_purchase_receipt(uuid,uuid,text,text,text,text)') is null
 or to_regprocedure('public.reserve_receipt_scan(uuid,uuid)') is null
 or to_regprocedure('public.save_order_fulfillment(uuid,jsonb)') is null
 or to_regprocedure('public.invoice_lines_snapshot(uuid)') is null then raise exception 'Expected operational baseline functions are missing'; end if;
 ${target === "production" ? `if to_regclass('public.businesses') is not null or to_regclass('public.business_memberships') is not null or to_regclass('public.platform_administrators') is not null or to_regclass('public.platform_audit_log') is not null then raise exception 'Production foundation already exists or is partial; reconcile before release'; end if;` : `if to_regclass('public.businesses') is null then raise exception 'Staging foundation is missing'; end if;
 if (select count(*) from public.businesses)<>1 or not exists(select 1 from public.businesses where slug='ahaa' and status='active' and not isolation_ready) then raise exception 'Unexpected staging businesses; review before release'; end if;`}
end; $$;
-- Capture this query result with the execution log before applying the release.
-- Metadata assists recovery planning; it is not a database/Auth/storage backup.
select jsonb_build_object(
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from pg_policies p where schemaname='public'),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'acl',p.proacl::text)),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))),'[]') from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public')
) as isolation_release_previous_access_metadata;
create temp table isolation_release_baseline(table_name text,checksum text) on commit drop;
do $$ declare n text; h text; begin
 foreach n in array array[${sqlTables}] loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,''[]'')) from public.%I t',n) into h;
 insert into isolation_release_baseline values(n,h);
 end loop;
end; $$;`;
const foundation = target === "production" ? await transactionBody("supabase/migrations/202611020001_business_foundation.sql", "commit") : "";
const isolation = await transactionBody("supabase/planned/business_isolation.draft.sql", "commit");
const memberships = await transactionBody("supabase/planned/workspace_memberships.draft.sql", "commit");
const unchanged = `
do $$ declare r record; h text; begin
 for r in select * from isolation_release_baseline loop
 execute format('select md5(coalesce(jsonb_agg(to_jsonb(t)-''business_id'' order by id)::text,''[]'')) from public.%I t',r.table_name) into h;
 if h<>r.checksum then raise exception 'Existing application records changed: %',r.table_name; end if;
 end loop;
 if not exists(select 1 from public.businesses where slug='ahaa' and status='active' and isolation_ready) then raise exception 'Ahaa workspace was not enabled'; end if;
 if to_regprocedure('public.current_workspace()') is null or to_regprocedure('public.my_workspaces()') is null then raise exception 'Workspace functions are missing'; end if;
end; $$;`;
const privileges = await transactionBody("supabase/planned/isolation_privilege_audit.tests.draft.sql", "rollback");
const assertions = [];
if (mode === "rehearsal" && target === "staging") {
  assertions.push(await transactionBody("supabase/planned/business_isolation.tests.draft.sql", "rollback"));
  assertions.push(await transactionBody("supabase/planned/workspace_memberships.tests.draft.sql", "rollback"));
  assertions.push("select set_config('request.headers',jsonb_build_object('x-business-id',(select id from public.businesses where slug='ahaa'))::text,true);");
  assertions.push(await transactionBody("supabase/tests/operations_refactor.sql", "rollback"));
}
const output = path.resolve(".local-backups/saas");
await fs.mkdir(output, { recursive: true });
const basename = `isolation-${target}-${mode}`;
const sql = [
  `-- PREPARED ONLY. Target: ${target}; mode: ${mode}. Verify the connected project before execution.`,
  "-- Coordinated cutover: NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED=true requires this database release.",
  "-- Legacy receipt RPCs are revoked; an old workspace-disabled deployment cannot be used as a standalone rollback.",
  "-- Includes existing Ahaa isolation only. No registration, owner onboarding, activation or platform-role grants.",
  ...(target === "production" && mode === "rehearsal" ? ["-- Production rehearsal validates schema/privileges/data preservation only; full two-business fixtures run in staging."] : []),
  "begin;", "set local lock_timeout='5s';", "set local statement_timeout='120s';", "select pg_advisory_xact_lock(730040101);",
  preflight, foundation, isolation, memberships, unchanged, privileges, ...assertions,
  mode === "release" ? "commit;" : "rollback;",
].join("\n");
await fs.writeFile(path.join(output, `${basename}.sql`), sql);
await fs.writeFile(path.join(output, `${basename}.manifest.json`), JSON.stringify({ target, mode, sources: sourceHashes, sqlSha256: createHash("sha256").update(sql).digest("hex"), onboardingIncluded: false, grantsPlatformAccess: false }, null, 2));
console.log(`Prepared .local-backups/saas/${basename}.sql and its source manifest. No external state changed.`);
if (target === "production" && mode === "rehearsal") console.log("This production rehearsal excludes synthetic two-business fixtures. It does not establish live HTTP/file acceptance.");
