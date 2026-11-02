import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (/\.(ts|tsx)$/.test(filename) && !filename.includes(".test.")) files.push(filename);
  }
}
walk(path.join(root, "src"));
const violations = [];
for (const filename of files) {
  const relative = path.relative(root, filename).replaceAll("\\", "/");
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text;
      const target = name.startsWith("@/") ? "src/" + name.slice(2)
        : name.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(relative), name)) : name;
      let reason;
      if (relative.startsWith("src/features/") && (target.startsWith("src/server/") || ["src/lib/supabase/admin", "src/lib/supabase/server"].includes(target))) reason = "Frontend features cannot import server implementations";
      if ((relative.startsWith("src/features/") || relative.startsWith("src/server/")) && target.startsWith("src/app/")) reason = "Modules cannot depend on route implementations";
      if (relative.startsWith("src/components/ui/") && target.startsWith("src/features/")) reason = "UI primitives cannot depend on business features";
      if (relative.startsWith("src/app/api/") && target.startsWith("src/app/api/")) reason = "API routes must delegate to shared services, not other routes";
      if (relative.startsWith("src/server/business/") && target.startsWith("src/server/platform/")) reason = "Business backend cannot depend on platform operations";
      if (relative.startsWith("src/server/platform/") && target.startsWith("src/server/business/")) reason = "Platform backend cannot depend on customer operations";
      if (relative.startsWith("src/server/infrastructure/") && (target.startsWith("src/server/business/") || target.startsWith("src/server/platform/"))) reason = "Infrastructure cannot depend on business or platform modules";
      if (relative.startsWith("src/app/api/platform/") && target.startsWith("src/server/business/")) reason = "Platform APIs cannot call business modules";
      if (relative.startsWith("src/app/api/") && !relative.startsWith("src/app/api/platform/") && target.startsWith("src/server/platform/")) reason = "Business APIs cannot call platform modules";
      if (relative.startsWith("src/app/api/") && target.startsWith("src/server/business/") && !/^src\/server\/business\/[^/]+\/endpoints$/.test(target)) reason = "Business API routes must use guarded feature endpoints";
      if (reason) violations.push(`${relative}: ${reason}: ${name}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (violations.length) { console.error(violations.join("\n")); process.exitCode = 1; }
else console.log(`Module boundaries passed (${files.length} source files).`);
