import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(path, dependencies) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,encodeURIComponent,...dependencies});
  return exports;
}
test("account data helpers retain server errors and send only the requested operation",async()=>{
  const requests=[];
  const api=load("src/lib/user-data.ts",{require:()=>({supabase:{}}),fetch:async(path,options)=>{requests.push({path,options});return {ok:false,json:async()=>({error:"Cannot delete your own account."})};}});
  await assert.rejects(api.deleteUserAccount("id/with/path"),/Cannot delete your own account/);
  assert.equal(requests[0].path,"/api/admin/users/id%2Fwith%2Fpath");
  assert.equal(requests[0].options.method,"DELETE");
  assert.equal(requests[0].options.body,undefined);
});
test("combining validates input before mutation and forwards selected orders",async()=>{
  const calls=[];
  const api=load("src/lib/invoice-data.ts",{require:path=>path.includes("pagination")?{}:{supabase:{from:()=>({select(){return this;},in(){return this;},eq:async()=>({data:[{id:"order-one",order_date:"2026-10-02"},{id:"order-two",order_date:"2026-10-10"}],error:null})}),rpc:async(name,args)=>{calls.push({name,args});return {data:"combined-id",error:null};}}}});
  await assert.rejects(api.createCombinedInvoice({branchId:"",startDate:"",endDate:""},[]));
  assert.equal(calls.length,0);
  const id=await api.createCombinedInvoice({branchId:"branch",startDate:"2026-10-01",endDate:"2026-10-12"},["order-one","order-two"]);
  assert.equal(id,"combined-id");
  assert.equal(calls[0].name,"create_weekly_invoice");
  assert.equal(calls[0].args.p_order_ids.join(","),"order-one,order-two");
  assert.equal(calls[0].args.p_start_date,"2026-10-02");
  assert.equal(calls[0].args.p_end_date,"2026-10-10");
});
