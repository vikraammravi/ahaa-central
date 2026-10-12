import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile = (path) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, Date });
  return exports;
};
const auth = compile("src/lib/auth.ts");
const format = compile("src/lib/format.ts");
test("only active recognized roles can enter protected areas", () => {
  assert.equal(auth.activeRole(null), null);
  for (const status of ["pending", "disabled", null]) assert.equal(auth.activeRole({ role: "CENTRAL_ADMIN", status }), null);
  assert.equal(auth.activeRole({ role: "UNKNOWN", status: "active" }), null);
  assert.equal(auth.activeRole({ role: "CENTRAL_ADMIN", status: "active" }), "CENTRAL_ADMIN");
});
test("return paths stay inside the signed-in role's area", () => {
  assert.equal(auth.safeNextPath("/admin/invoices?tab=open", "CENTRAL_ADMIN"), "/admin/invoices?tab=open");
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "/admin/../login", "/branch/home", "/administrator", "javascript:alert(1)"]) assert.equal(auth.safeNextPath(next, "CENTRAL_ADMIN"), "/admin/dashboard");
});
test("formatting uses Canadian currency, simple tax labels, and Toronto business dates", () => {
  assert.equal(format.formatMoney(12.5), "CA$12.50");
  assert.equal(format.taxLabel(true), "13%");
  assert.equal(format.taxLabel(false), "N/A");
  assert.equal(format.formatDate("2026-10-11T02:00:00Z"), "Oct 10, 2026");
  assert.equal(format.formatDate("2026-10-11"), "Oct 11, 2026");
});

test("employees land in inventory and cannot use manager or admin return paths", () => {
 assert.equal(auth.activeRole({role:"BRANCH_EMPLOYEE",status:"active"}),"BRANCH_EMPLOYEE");
 assert.equal(auth.userHome("BRANCH_EMPLOYEE"),"/employee/inventory");
 assert.equal(auth.safeNextPath("/employee/profile","BRANCH_EMPLOYEE"),"/employee/profile");
 for(const path of ["/admin/users","/branch/order","/employee/../branch/invoices"]) assert.equal(auth.safeNextPath(path,"BRANCH_EMPLOYEE"),"/employee/inventory");
});
