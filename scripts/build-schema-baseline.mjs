import fs from "node:fs";

// Input is the schema-only JSON produced by supabase/export-baseline.sql.
// This deliberately does not export rows, users, credentials, Storage objects,
// extension internals, publication memberships or platform-managed schemas.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/build-schema-baseline.mjs inventory.json baseline.sql");
const schema = JSON.parse(fs.readFileSync(input, "utf8"));
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const tableName = name => `public.${quote(name)}`;
const sql = [
  "-- Generated application-schema baseline. REVIEW AND TEST ON EMPTY STAGING ONLY.",
  "-- No production users, transactions or receipt files are included.",
  "-- Existing incremental migrations predate this snapshot; do not replay them after it.",
  "begin;", "set local search_path = public, extensions;", "set local check_function_bodies = off;",
  "do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') then raise exception 'Baseline requires an empty public schema'; end if; end $$;",
];
for (const entry of schema.enums) sql.push(`create type ${tableName(entry.name)} as enum (${entry.labels.map(literal).join(", ")});`);
// Identity sequences are created by their owning identity columns instead.
const identitySequences = new Set();
for (const table of schema.tables) for (const column of table.columns) {
  if (column.identity) identitySequences.add(`${table.name}_${column.name}_seq`);
}
for (const sequence of schema.sequences) {
  if (identitySequences.has(sequence.sequencename)) continue;
  sql.push(`create sequence ${tableName(sequence.sequencename)} as ${sequence.data_type} increment by ${sequence.increment_by} minvalue ${sequence.min_value} maxvalue ${sequence.max_value} start with ${sequence.start_value} ${sequence.cycle ? "cycle" : "no cycle"};`);
}
for (const table of schema.tables) {
  const columns = table.columns.map(column => {
    let definition = `${quote(column.name)} ${column.type}`;
    if (column.generated) definition += ` generated always as (${column.default}) stored`;
    else if (column.identity) definition += ` generated ${column.identity === "a" ? "always" : "by default"} as identity`;
    else if (column.default !== null) definition += ` default ${column.default}`;
    if (column.not_null) definition += " not null";
    return definition;
  });
  sql.push(`create table ${tableName(table.name)} (\n  ${columns.join(",\n  ")}\n);`);
}
for (const constraint of schema.constraints) sql.push(`alter table ${tableName(constraint.table_name)} add constraint ${quote(constraint.name)} ${constraint.definition};`);
for (const index of schema.indexes) sql.push(index.definition + ";");
for (const fn of schema.functions) {
  sql.push(fn.definition.trim().replace(/;?$/, ";"));
  const signature = `${tableName(fn.name)}(${fn.arguments})`;
  sql.push(`revoke all on function ${signature} from public, anon, authenticated, service_role;`);
  if (fn.acl === null) sql.push(`grant execute on function ${signature} to public;`);
  else for (const entry of fn.acl.slice(1, -1).split(",")) {
    const match = /^([^=]*)=([^/]*)\//.exec(entry);
    if (!match?.[2].includes("X") || match[1] === "postgres") continue;
    const role = match[1] === "" ? "public" : quote(match[1]);
    sql.push(`grant execute on function ${signature} to ${role}${match[2].includes("X*") ? " with grant option" : ""};`);
  }
}
for (const trigger of schema.triggers) {
  sql.push(trigger.definition + ";");
  const mode = { D: "disable", R: "enable replica", A: "enable always" }[trigger.enabled];
  if (mode) sql.push(`alter table ${quote(trigger.schema_name)}.${quote(trigger.table_name)} ${mode} trigger ${quote(trigger.name)};`);
}
for (const table of schema.tables) {
  sql.push(`revoke all on table ${tableName(table.name)} from public, anon, authenticated, service_role;`);
  if (table.rls) sql.push(`alter table ${tableName(table.name)} enable row level security;`);
  if (table.force_rls) sql.push(`alter table ${tableName(table.name)} force row level security;`);
}
for (const policy of schema.policies) {
  let statement = `create policy ${quote(policy.policyname)} on ${tableName(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(role => role === "public" ? "public" : quote(role)).join(", ")}`;
  if (policy.qual !== null) statement += ` using (${policy.qual})`;
  if (policy.with_check !== null) statement += ` with check (${policy.with_check})`;
  sql.push(statement + ";");
}
for (const grant of schema.grants) {
  if (grant.grantee === "postgres") continue;
  sql.push(`grant ${grant.privilege_type} on table ${tableName(grant.table_name)} to ${grant.grantee === "PUBLIC" ? "public" : quote(grant.grantee)}${grant.is_grantable === "YES" ? " with grant option" : ""};`);
}
sql.push("-- REVIEW sequence grants, extensions and schema privileges separately before applying.", "notify pgrst, 'reload schema';", "commit;");
fs.writeFileSync(output, sql.join("\n\n") + "\n");
console.log(`Generated draft baseline: ${schema.tables.length} tables, ${schema.functions.length} functions, ${schema.policies.length} policies. Not applied.`);
