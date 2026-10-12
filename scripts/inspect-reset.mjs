import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw new Error("Server key is missing");
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const schema=JSON.parse(await fs.readFile("supabase/schema.snapshot.json","utf8"));
const tables=[...new Set(schema.columns.map(column=>column.table))];
const users=[];
for(let page=1;;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:100});if(error)throw error;users.push(...data.users);if(data.users.length<100)break;}
const records={};
for(const table of tables){records[table]=[];for(let from=0;;from+=1000){const {data,error}=await client.from(table).select("*").order("id").range(from,from+999);if(error)throw error;records[table].push(...data);if(data.length<1000)break;}}
const backup={capturedAt:new Date().toISOString(),records,authUsers:users};
await fs.mkdir(".local-backups",{recursive:true});
const file=`.local-backups/full-reset-${Date.now()}.json`;
await fs.writeFile(file,JSON.stringify(backup,null,2));
console.log(JSON.stringify({backup:file,counts:Object.fromEntries(tables.map(table=>[table,records[table].length])),profiles:records.profiles.map(({id,full_name,email,role,status})=>({id,full_name,email,role,status})),authUserCount:users.length},null,2));
