import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const actorId="11111111-1111-1111-1111-111111111111";
const targetId="22222222-2222-2222-2222-222222222222";
function load(path,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require,Response,URL});return exports;}
function deletion(role="CENTRAL_ADMIN",signedIn=true,fail=false){
  const removed=[];
  const session={auth:{getUser:async()=>({data:{user:signedIn?{id:actorId}:null},error:null})},from(){const query={select(){return query;},eq(column,value){query.id=value;return query;},single:async()=>({data:query.id===actorId?{role,status:"active"}:{id:targetId},error:null})};return query;}};
  const api=load("src/app/api/admin/users/[id]/route.ts",name=>name.includes("/server")?{createSupabaseServer:async()=>session}:name.includes("supabase/admin")?{createSupabaseAdmin:()=>({auth:{admin:{deleteUser:async id=>{removed.push(id);return {error:fail?new Error("failure"):null};}}}})}:{activeRole:profile=>profile.status==="active"?profile.role:null});
  return {removed,run:(id=targetId,origin="http://localhost:3000")=>api.DELETE(new Request(`http://localhost:3000/api/admin/users/${id}`,{method:"DELETE",headers:{origin}}),{params:Promise.resolve({id})})};
}
test("user deletion requires active admin, matching origin and a different account",async()=>{
  for(const role of ["BRANCH_MANAGER","BRANCH_EMPLOYEE"]){const api=deletion(role);assert.equal((await api.run()).status,403);assert.equal(api.removed.length,0);}
  assert.equal((await deletion("CENTRAL_ADMIN",false).run()).status,401);
  const api=deletion();assert.equal((await api.run(actorId)).status,400);assert.equal((await api.run(targetId,"https://other.invalid")).status,403);assert.equal(api.removed.length,0);
});
test("admin deletion removes the auth account and does not report success on failure",async()=>{
  const api=deletion();assert.equal((await api.run()).status,200);assert.deepEqual(api.removed,[targetId]);
  assert.equal((await deletion("CENTRAL_ADMIN",true,true).run()).status,400);
});
test("recovery exchanges valid links and rejects invalid links without open redirects",async()=>{
  const calls=[];
  const api=load("src/app/auth/confirm/route.ts",name=>name==="next/server"?{NextResponse:{redirect:url=>new Response(null,{status:307,headers:{location:url.toString()}})}}:{createSupabaseServer:async()=>({auth:{verifyOtp:async args=>{calls.push(args);return {error:null};},exchangeCodeForSession:async code=>({error:code==="expired"?new Error("expired"):null})}})});
  const result=await api.GET(new Request("https://app.example/auth/confirm?token_hash=hash&type=recovery&next=https://other.invalid"));
  assert.equal(result.headers.get("location"),"https://app.example/set-password?flow=reset");assert.equal(calls[0].type,"recovery");assert.equal(result.headers.get("Cache-Control"),"no-store");
  for(const query of ["","?code=expired","?token_hash=hash&type=signup"]){const rejected=await api.GET(new Request(`https://app.example/auth/confirm${query}`));assert.equal(rejected.headers.get("location"),"https://app.example/forgot-password?error=invalid_link");}
});
test("new password checks enforce length and matching confirmation",()=>{
  const api=load("src/lib/passwords.ts",()=>{});
  assert.throws(()=>api.validateNewPassword("short","short"));
  assert.throws(()=>api.validateNewPassword("secure-password","different-password"));
  assert.doesNotThrow(()=>api.validateNewPassword("secure-password","secure-password"));
});
