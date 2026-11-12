import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";

// Names only, from a bounded allowlist. No credentials, backups or source contents.
const root = process.cwd();
const sections = ["src/features", "src/server", "src/app", "src/components/shared", "src/lib", "supabase/migrations", "supabase/planned", "supabase/tests", "docs", "tests/mocks"];
async function files(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const result = [];
  for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) continue;
    const target = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(target));
    else if (/\.(?:ts|tsx|mjs|sql|md)$/.test(entry.name)) result.push(relative(root, target).replaceAll("\\", "/"));
  }
  return result;
}
const index = {};
for (const section of sections) index[section] = await files(resolve(root, section));
if (!index["src/app"].length) throw new Error("Run this index from the Ahaa repository root.");
console.log(JSON.stringify({ purpose: "File discovery only; verify behavior and deployments separately", sections: index }, null, 2));
