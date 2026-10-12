import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/weekly.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api});
const settled={status:"COMPLETED",weekly_invoice_id:null,pickup_approval_status:null,pickup_requests:[]};
test("only completed, settled, unbilled orders can join a weekly invoice",()=>{
  assert.equal(api.eligibleForWeekly(settled),true);
  assert.equal(api.eligibleForWeekly({...settled,status:"READY"}),false);
  assert.equal(api.eligibleForWeekly({...settled,weekly_invoice_id:"existing"}),false);
  assert.equal(api.eligibleForWeekly({...settled,pickup_approval_status:"PENDING"}),false);
  assert.equal(api.eligibleForWeekly({...settled,pickup_requests:[{return_status:"PENDING"}]}),false);
  assert.equal(api.eligibleForWeekly({...settled,pickup_requests:[{return_status:"RECEIVED"}]}),true);
});
