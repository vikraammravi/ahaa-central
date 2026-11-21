import fs from "node:fs/promises";

// Offline preparation only: no database connection. Wraps the onboarding
// migrations and their tests in one transaction that always ends in ROLLBACK.
// Pass --tests-only where the migrations are already installed (e.g. staging).
const testsOnly = process.argv.includes("--tests-only");
const migrations = [
  "supabase/migrations/202611200002_platform_onboarding.sql",
  "supabase/migrations/202611200003_platform_onboarding_resolve_guard.sql",
];
const tests = [
  "supabase/tests/platform_onboarding_existing_owner.sql",
  "supabase/tests/platform_owner_invitations.sql",
  "supabase/tests/platform_owner_invitation_rate.sql",
  "supabase/tests/platform_owner_invitation_management.sql",
];
const migrationSql = testsOnly ? [] : await Promise.all(migrations.map(async path => {
  const sql = await fs.readFile(path, "utf8");
  if (!/^begin;\s*$/im.test(sql) || !/^commit;\s*$/im.test(sql)) throw new Error(`Unexpected transaction boundary: ${path}`);
  const body = sql.replace(/^begin;\s*$/im, "").replace(/^commit;\s*$/im, "");
  if (/^\s*(begin|commit|rollback);\s*$/im.test(body)) throw new Error(`Additional transaction boundary: ${path}`);
  return body;
}));
const testSql = await Promise.all(tests.map(path => fs.readFile(path, "utf8")));
testSql.forEach((sql, index) => { if (/^\s*(begin|commit|rollback);\s*$/im.test(sql)) throw new Error(`Unexpected test transaction boundary: ${tests[index]}`); });
const backslash = String.fromCharCode(92); // psql meta-commands
const body = [...migrationSql, ...testSql.flatMap((sql, index) => [`reset role;`, `${backslash}echo '== ${tests[index]}'`, sql])];
await fs.mkdir(".local-backups/agent-workflows", { recursive: true });
await fs.writeFile(".local-backups/agent-workflows/platform-onboarding-rehearsal.sql", ["-- STAGING ONLY: always ends in ROLLBACK.", `${backslash}set ON_ERROR_STOP on`, "begin;", "set local timezone = 'America/Toronto';", ...body, "reset role;", "select 'PLATFORM ONBOARDING REHEARSAL PASSED' as result;", "rollback;", ""].join("\n"));
console.log(`Prepared rollback-only staging rehearsal${testsOnly ? " (tests only)" : ""}; no database connection was made.`);
