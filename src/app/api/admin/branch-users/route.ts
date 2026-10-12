import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isBranchUserRole } from "@/lib/users";
import { activeRole } from "@/lib/auth";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (request.headers.get("origin") !== expectedOrigin) return Response.json({error:"Request not allowed."}, {status:403});
  const session = await createSupabaseServer();
  const {data:{user},error:authError} = await session.auth.getUser();
  if (!user || authError) return Response.json({error:"Sign in first."}, {status:401});
  const {data:profile,error:profileError} = await session.from("profiles").select("role,status").eq("id",user.id).single();
  if (profileError || activeRole(profile) !== "CENTRAL_ADMIN") return Response.json({error:"Only an active central admin can create branch users."}, {status:403});
  let input: unknown;
  try {input=await request.json();} catch {return Response.json({error:"Invalid user details."},{status:400});}
  if (!input || typeof input!=="object") return Response.json({error:"Invalid user details."},{status:400});
  const body=input as Record<string,unknown>;
  const role=body.role??"BRANCH_EMPLOYEE";
  if(!isBranchUserRole(role))return Response.json({error:"Choose Branch Manager or Branch Employee."},{status:400});
  const fullName=typeof body.fullName==="string"?body.fullName.trim():"";
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
  const password=typeof body.password==="string"?body.password:"";
  const locationId=typeof body.locationId==="string"?body.locationId:"";
  if (!fullName || fullName.length>200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length<12 || password.length>128 || !/^[0-9a-f-]{36}$/i.test(locationId)) return Response.json({error:"Enter a name, valid email, assigned branch and a password of 12–128 characters."},{status:400});
  const {data:branch,error:branchError}=await session.from("locations").select("id").eq("id",locationId).eq("is_central",false).single();
  if(branchError||!branch)return Response.json({error:"Choose a valid branch."},{status:400});
  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {admin=createSupabaseAdmin();} catch {return Response.json({error:"Branch account creation is not configured on the server yet."},{status:503});}
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName}});
  if(createError||!created.user)return Response.json({error:createError?.message??"Unable to create user."},{status:400});
  const {error:assignmentError}=await admin.from("profiles").update({full_name:fullName,role,status:"active",location_id:locationId}).eq("id",created.user.id).select("id").single();
  if(assignmentError){
    const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
    return Response.json({error:cleanupError?"Account needs admin attention: branch assignment failed. Check Users & Access before retrying.":"Unable to assign the user. No account was created."},{status:500});
  }
  return Response.json({id:created.user.id},{status:201});
}
