import fs from "node:fs";
const schema = JSON.parse(fs.readFileSync("supabase/schema.snapshot.json", "utf8"));
const enums = schema.enums ?? {};
const typeOf = (name) => {
  if (name.startsWith("_")) return `(${typeOf(name.slice(1))})[]`;
  if (enums[name]) return `DatabaseEnums[${JSON.stringify(name)}]`;
  if (["int2", "int4", "int8", "float4", "float8", "numeric", "money"].includes(name)) return "number";
  if (name === "bool") return "boolean";
  if (["json", "jsonb"].includes(name)) return "Json";
  return "string";
};
const tables = schema.columns.reduce((groups, column) => {
  (groups[column.table] ??= []).push(column);
  return groups;
}, Object.create(null));
const fields = (columns, mode) => columns.map((column) => {
  const optional = mode === "Update" || (mode === "Insert" && (column.nullable || column.default !== null || column.generated));
  const type = column.generated && mode !== "Row" ? "never" : `${typeOf(column.type)}${column.nullable ? " | null" : ""}`;
  return `      ${JSON.stringify(column.name)}${optional ? "?" : ""}: ${type};`;
}).join("\n");
let output = '// Generated from supabase/schema.snapshot.json. Run node scripts/generate-database-types.mjs to refresh.\n';
output += 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\n';
output += 'export type DatabaseEnums = {\n' + Object.entries(enums).map(([name, values]) => `  ${JSON.stringify(name)}: ${values.map((value) => JSON.stringify(value)).join(" | ")};`).join("\n") + '\n};\n\n';
output += 'export type DatabaseTables = {\n' + Object.entries(tables).map(([name, columns]) => `  ${JSON.stringify(name)}: {\n${["Row", "Insert", "Update"].map((mode) => `    ${mode}: {\n${fields(columns, mode)}\n    };`).join("\n")}\n  };`).join("\n") + '\n};\n';
fs.writeFileSync("src/lib/supabase/database.generated.ts", output);
console.log(`Generated ${Object.keys(tables).length} table types and ${Object.keys(enums).length} enums.`);
