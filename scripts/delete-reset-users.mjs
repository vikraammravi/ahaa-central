// Only use after explicit permanent-reset confirmation and full_test_reset.sql.
import {createClient} from "@supabase/supabase-js";
const keep="21bf35b6-b5d7-4946-a2b9-94a56ce4119b";
const targets=["ab749190-dc9b-48ac-92c2-e1d4faef67e6","e2ef2b0c-074d-45cc-9f37-e6aacccb4ab4"];
if(process.argv[2]!=="confirmed-full-reset")throw new Error("Explicit confirmation argument required");
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw new Error("Missing server key");
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const profiles=await client.from("profiles").select("id,role,status,email");
if(profiles.error)throw profiles.error;
if(profiles.data.length!==1||profiles.data[0].id!==keep||profiles.data[0].role!=="CENTRAL_ADMIN"||profiles.data[0].status!=="active")throw new Error("Public reset must leave the preserved admin first");
const users=await client.auth.admin.listUsers({page:1,perPage:100});
if(users.error)throw users.error;
if(users.data.users.some(user=>user.id!==keep&&!targets.includes(user.id)))throw new Error("Unexpected user account: stop and inspect");
if(!users.data.users.some(user=>user.id===keep&&user.email==="admin@aahatrulysouth.com"))throw new Error("Preserved Auth account does not match");
for(const id of targets){if(!users.data.users.some(user=>user.id===id))continue;const {error}=await client.auth.admin.deleteUser(id);if(error)throw error;}
const remaining=await client.auth.admin.listUsers({page:1,perPage:100});
if(remaining.error)throw remaining.error;
if(remaining.data.users.length!==1||remaining.data.users[0].id!==keep)throw new Error("Unexpected remaining Auth accounts");
console.log("Only Nagesh's admin login remains. Password unchanged.");
