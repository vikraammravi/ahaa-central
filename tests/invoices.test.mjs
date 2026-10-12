import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (file, require = () => { throw new Error("Unexpected import"); }) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require });
  return exports;
};
const catering = compile("src/lib/catering.ts");
const format = compile("src/lib/format.ts");
const invoices = compile("src/lib/invoices.ts", (name) => name === "./format" ? format : catering);
const order = { order_date: "2026-10-10", created_at: "2026-10-10T00:30:00Z", location_id: "branch-a" };

test("invoice range includes both endpoints and supports either open end", () => {
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-10", endDate: "2026-10-10", branchId: "" }), true);
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "", endDate: "2026-10-10", branchId: "" }), true);
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-10", endDate: "", branchId: "" }), true);
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-11", endDate: "", branchId: "" }), false);
});
test("branch and date filters combine; reversed ranges return no invoices", () => {
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-01", endDate: "2026-10-31", branchId: "branch-a" }), true);
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-01", endDate: "2026-10-31", branchId: "branch-b" }), false);
  assert.equal(invoices.invoiceMatchesFilters(order, { startDate: "2026-10-11", endDate: "2026-10-01", branchId: "" }), false);
});
test("invoice date uses the stored order date across midnight and time zones", () => {
  assert.equal(invoices.invoiceDateKey(order), "2026-10-10");
});
test("customer calls use telephone links and reject missing or invalid numbers", () => {
  assert.equal(catering.phoneHref("+1 (416) 555-1234"), "tel:+14165551234");
  assert.equal(catering.phoneHref("416-555-1234"), "tel:4165551234");
  assert.equal(catering.phoneHref(""), null);
  assert.equal(catering.phoneHref("123"), null);
});
test("editing catering preserves the event's local calendar date", () => {
  const date = new Date(2026, 9, 10, 23, 30);
  assert.equal(catering.localDateInput(date), "2026-10-10");
});

const editLines = [{ id: "item", quantity: 5, fulfilled_quantity: 3, unit_price: 2, is_taxable: true }];
test("invoice editing validates quantities and currency precision", () => {
  const valid = { quantity: "5", unitPrice: "2.50", taxable: false };
  assert.equal(invoices.invoiceDraftError(editLines, { item: valid }), null);
  for (const quantity of ["", "-1", "1.5", "2147483648"]) assert.notEqual(invoices.invoiceDraftError(editLines, { item: { ...valid, quantity } }), null);
  assert.equal(invoices.invoiceDraftError(editLines,{item:{...valid,quantity:"7"}}),null);
  for (const unitPrice of ["", "-1", "1.234", "NaN", "100000000"]) assert.notEqual(invoices.invoiceDraftError(editLines, { item: { ...valid, unitPrice } }), null);
});
test("invoice preview recalculates edited price, quantity, and tax", () => {
  const taxable = invoices.invoiceDraftTotals(editLines, { item: { quantity: "4", unitPrice: "2.50", taxable: true } });
  assert.equal(taxable.subtotal, 10);
  assert.equal(taxable.tax.toFixed(2), "1.30");
  assert.equal(taxable.total.toFixed(2), "11.30");
  const exempt = invoices.invoiceDraftTotals(editLines, { item: { quantity: "4", unitPrice: "2.50", taxable: false } });
  assert.equal(exempt.total, 10);
});
