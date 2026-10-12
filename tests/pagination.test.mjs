import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function moduleApi(path, require = () => {throw new Error("Unexpected import");}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require});
  return exports;
}
const pagination=moduleApi("src/lib/pagination.ts");
test("pagination covers records once and recovers the last page after deletion",()=>{
  assert.equal(pagination.pageRange(0).join(","),"0,24");
  assert.equal(pagination.pageRange(1).join(","),"25,49");
  assert.equal(pagination.lastPage(25),0);
  assert.equal(pagination.lastPage(26),1);
  assert.equal(pagination.lastPage(0),0);
});
test("search quotes filter punctuation and escapes wildcard input",()=>{
  const filter=pagination.searchFilter(["full_name","email"],' Jane, ("admin")% ');
  assert.ok(filter.startsWith('full_name.ilike."%Jane, (\\"admin\\")'));
  assert.ok(filter.includes('\\\\%'));
  assert.ok(filter.includes(',email.ilike."'));
});
test("catering applies search and status before paging and recovers an empty last page",async()=>{
  const calls=[];let request=0;
  const client={from(table){calls.push(["from",table]);const query={};for(const method of ["select","order","eq","or","range"])query[method]=(...args)=>{calls.push([method,...args]);return query;};query.abortSignal=async()=>++request===1?{data:[],count:25,error:null}:{data:[{id:"remaining"}],count:25,error:null};return query;}};
  const api=moduleApi("src/lib/catering-data.ts",path=>path.includes("pagination")?pagination:{supabase:client});
  const result=await api.fetchCatering({page:1,search:"Jane",status:"CONFIRMED"},new AbortController().signal);
  assert.equal(result.page,0);
  assert.equal(result.rows[0].id,"remaining");
  assert.equal(calls.filter(call=>call[0]==="range").map(call=>call.slice(1).join(",")).join(";"),"25,49;0,24");
  assert.ok(calls.some(call=>call[0]==="eq"&&call[1]==="status"&&call[2]==="CONFIRMED"));
  assert.ok(calls.findIndex(call=>call[0]==="or")<calls.findIndex(call=>call[0]==="range"));
});
