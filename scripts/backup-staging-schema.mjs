import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// This narrowly scoped backup never accepts a production host or writes credentials.
// Put STAGING_DB_PASSWORD in .env.local; do not pass it in command-line arguments.
const config = await readFile(".env.local", "utf8");
const match = config.match(/^STAGING_DB_PASSWORD=(.*)$/m);
if (!match) throw new Error("STAGING_DB_PASSWORD is not configured in .env.local.");
const password = match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
if (!password) throw new Error("STAGING_DB_PASSWORD is empty.");
const tool = resolve(".local-backups/saas/postgresql-17-bin/pg_dump.exe");
const destination = resolve(".local-backups/saas/staging-pre-isolation");
await mkdir(destination, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const args = ["--host=aws-0-us-east-1.pooler.supabase.com", "--port=5432", "--username=postgres.rvldwakcwxbnqyuttzkn", "--dbname=postgres", "--schema=public", "--schema-only", "--format=custom", "--no-owner", `--file=${destination}/public-schema-${stamp}.dump`];
const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) if (key.toUpperCase().startsWith("PG")) delete childEnv[key];
Object.assign(childEnv, { PGPASSWORD: password, PGSSLMODE: "verify-full", PGSSLROOTCERT: resolve(".local-backups/saas/staging-db-ca.crt"), PGCONNECT_TIMEOUT: "15" });
const exitCode = await new Promise((resolveCode, reject) => {
  const child = spawn(tool, args, { env: childEnv, stdio: ["ignore", "inherit", "inherit"], windowsHide: true });
  child.once("error", reject);
  child.once("close", resolveCode);
});
if (exitCode !== 0) throw new Error("Staging schema backup failed.");
console.log("Staging public schema backup saved. Auth, storage objects and database roles are not included.");
