import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/invoice-summary.ts", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:api});
test("invoice summaries preserve branch publication amounts while admin sees current corrections", () => {
  const invoice = {sent_revision:2,orders:[{id:"one",order_number:1,order_date:"2026-10-12",final_total_amount:120}],weekly_invoice_publications:[{revision:1,snapshot:{orders:[{id:"one",total:70}]}},{revision:2,snapshot:{orders:[{id:"one",total:100}]}}]};
  assert.equal(api.invoiceSummaryOrders(invoice,true)[0].total,120);
  assert.equal(api.invoiceSummaryOrders(invoice,false)[0].total,100);
  assert.equal(api.invoiceSummaryOrders({...invoice,weekly_invoice_publications:[]},false).length,0);
});
