import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function setup(role="CENTRAL_ADMIN",signedIn=true,assignmentFails=false){
 const calls={created:[],assigned:[],removed:[]};
 const session={auth:{getUser:async()=>({data:{user:signedIn?{id:"admin"}:null},error:null})},from:(table)=>{const query={select(){return query;},eq(){return query;},single:async()=>({data:table==="profiles"?{role,status:"active"}:{id:"branch"},error:null})};return query;}};
 const privileged={auth:{admin:{createUser:async(args)=>{calls.created.push(args);return {data:{user:{id:"new-employee"}},error:null};},deleteUser:async(id)=>{calls.removed.push(id);return {error:null};}}},from:()=>{const query={update(args){calls.assigned.push(args);return query;},eq(){return query;},select(){return query;},single:async()=>({error:assignmentFails?new Error("assignment"):null})};return query;}};
 const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/app/api/admin/branch-users/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:api,Request,Response,URL,require:name=>name.includes("/server")?{createSupabaseServer:async()=>session}:name.includes("supabase/admin")?{createSupabaseAdmin:()=>privileged}:name.includes("/users")?{isBranchUserRole:value=>["BRANCH_MANAGER","BRANCH_EMPLOYEE"].includes(value)}:{activeRole:p=>p?.status==="active"?p.role:null}});
 return {calls,post:api.POST};
}
const details={fullName:"Employee",email:"staff@example.invalid",password:"A-test-password-123",locationId:"11111111-1111-1111-1111-111111111111",role:"BRANCH_EMPLOYEE"};
const request=(origin="http://localhost:3000",body=details)=>new Request("http://localhost:3000/api/admin/branch-users",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
test("employee creation requires an active admin and same-origin request",async()=>{
 for(const role of ["BRANCH_MANAGER","BRANCH_EMPLOYEE"]){const api=setup(role);assert.equal((await api.post(request())).status,403);assert.equal(api.calls.created.length,0);}
 const guest=setup("CENTRAL_ADMIN",false);assert.equal((await guest.post(request())).status,401);
 const api=setup();assert.equal((await api.post(request("https://other.invalid"))).status,403);assert.equal(api.calls.created.length,0);
});
test("admin creation assigns employee-only role and never returns the password",async()=>{
 const api=setup();const response=await api.post(request());assert.equal(response.status,201);assert.equal(api.calls.assigned[0].role,"BRANCH_EMPLOYEE");assert.equal(api.calls.assigned[0].location_id,details.locationId);const result=await response.text();assert.ok(!result.includes(details.password));assert.ok(!result.includes("CENTRAL_ADMIN"));
});
test("failed branch assignment cleans up only the newly created account",async()=>{const api=setup("CENTRAL_ADMIN",true,true);assert.equal((await api.post(request())).status,500);assert.deepEqual(api.calls.removed,["new-employee"]);});

test("admin can create a branch manager but cannot create a central admin through this form",async()=>{
const api=setup();assert.equal((await api.post(request("http://localhost:3000",{...details,role:"BRANCH_MANAGER"}))).status,201);assert.equal(api.calls.assigned[0].role,"BRANCH_MANAGER");const denied=setup();assert.equal((await denied.post(request("http://localhost:3000",{...details,role:"CENTRAL_ADMIN"}))).status,400);assert.equal(denied.calls.created.length,0);
});
test("account creation accepts the actual browser host when Next uses an internal request hostname",async()=>{const api=setup();const req=new Request("http://localhost:3000/api/admin/branch-users",{method:"POST",headers:{origin:"http://127.0.0.1:3000",host:"127.0.0.1:3000","Content-Type":"application/json"},body:JSON.stringify(details)});assert.equal((await api.post(req)).status,201);});
