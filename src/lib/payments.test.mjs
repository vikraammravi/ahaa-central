import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile=path=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;};
const payments=compile("src/lib/payments.ts");const catering=compile("src/lib/catering.ts");
test("paid invoices require review only when the visible revision is newer",()=>{assert.equal(payments.paymentNeedsReview({payment_status:"UNPAID",payment_revision:null},2),false);assert.equal(payments.paymentNeedsReview({payment_status:"PAID",payment_revision:1},1),false);assert.equal(payments.paymentNeedsReview({payment_status:"PAID",payment_revision:1},2),true);assert.equal(payments.paymentNeedsReview({payment_status:"PAID",payment_revision:2},1),false);});
test("WhatsApp uses Canadian or explicit international numbers and rejects ambiguous numbers",()=>{assert.equal(catering.whatsappHref("(416) 555-1234"),"https://wa.me/14165551234");assert.equal(catering.whatsappHref("+1 (416) 555-1234"),"https://wa.me/14165551234");assert.equal(catering.whatsappHref("+91 9876543210"),"https://wa.me/919876543210");assert.equal(catering.whatsappHref("0091 9876543210"),"https://wa.me/919876543210");assert.equal(catering.whatsappHref("5551234"),null);assert.equal(catering.whatsappHref(""),null);});
