import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { activeRole } from "@/lib/auth";

export async function DELETE(request: Request, context: {params:Promise<{id:string}>}) {
  const url = new URL(request.url);
  if(request.headers.get("origin") !== `${url.protocol}//${request.headers.get("host") || url.host}`)
    return Response.json({error:"Request not allowed."},{status:403});
  const session = await createSupabaseServer();
  const {data:{user},error} = await session.auth.getUser();
  if(!user || error) return Response.json({error:"Sign in first."},{status:401});
  const actor = await session.from("profiles").select("role,status").eq("id",user.id).single();
  if(actor.error || activeRole(actor.data)!=="CENTRAL_ADMIN") return Response.json({error:"Only an active admin can delete users."},{status:403});
  const {id}=await context.params;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({error:"Invalid user."},{status:400});
  if(id===user.id) return Response.json({error:"You cannot delete your own account."},{status:400});
  const target=await session.from("profiles").select("id").eq("id",id).single();
  if(target.error || !target.data) return Response.json({error:"User not found."},{status:404});
  let admin:ReturnType<typeof createSupabaseAdmin>;
  try{admin=createSupabaseAdmin();}catch{return Response.json({error:"User management is not configured on this server."},{status:503});}
  // Auth deletion cascades to the profile; history references are SET NULL.
  const result=await admin.auth.admin.deleteUser(id);
  if(result.error) return Response.json({error:"Unable to delete the account. Its login and records have not been changed."},{status:400});
  return Response.json({deleted:true});
}
