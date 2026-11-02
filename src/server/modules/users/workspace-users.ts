import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { loadSessionProfile } from "@/features/workspaces/session";
import { businessWorkspacesEnabled, validBusinessId } from "@/features/workspaces/context";
import { isBranchUserRole } from "@/features/users/domain";
import { hasSameOrigin } from "@/lib/request-origin";

class AccessError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function authorize(request: Request) {
  if (!businessWorkspacesEnabled()) throw new AccessError("Workspace management is not enabled.", 404);
  if (!hasSameOrigin(request)) throw new AccessError("Request not allowed.", 403);
  const session = await createSupabaseServer();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new AccessError("Sign in first.", 401);
  const actor = await loadSessionProfile(session, user.id);
  if (actor.error || !actor.business || actor.profile?.role !== "CENTRAL_ADMIN" || actor.profile.status !== "active") throw new AccessError("An active business admin is required.", 403);
  return { session, user, business: actor.business };
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Unable to update business access." }, { status: error instanceof AccessError ? error.status : 400, headers: { "Cache-Control": "no-store" } });
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length")) > 16000) throw new AccessError("User details are too large.", 413);
  const input: unknown = await request.json();
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid user details.");
  return input as Record<string, unknown>;
}
type Context = { params: Promise<{ id: string }> };

export async function removeBusinessUser(request: Request, context: Context) {
  try {
    const { session, user } = await authorize(request);
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new Error("Invalid user.");
    if (id === user.id) throw new Error("You cannot remove your own access.");
    const result = await session.rpc("remove_business_member", { p_user_id: id });
    if (result.error) throw new Error(result.error.message);
    if (result.data !== true) throw new AccessError("Member not found.", 404);
    // Never delete identity or memberships in other businesses.
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function updateBusinessUser(request: Request, context: Context) {
  try {
    const { session } = await authorize(request);
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new Error("Invalid user.");
    const changes = await body(request);
    const result = await session.rpc("update_business_member", { p_user_id: id, p_changes: changes });
    if (result.error) throw new Error(result.error.message);
    return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function createBusinessUser(request: Request) {
  try {
    const { session, user, business } = await authorize(request);
    const input = await body(request);
    const role = input.role ?? "BRANCH_EMPLOYEE";
    if (!isBranchUserRole(role)) throw new Error("Choose Branch Manager or Branch Employee.");
    const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const locationId = typeof input.locationId === "string" ? input.locationId : "";
    if (!fullName || fullName.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || password.length < 12 || password.length > 128 || !validBusinessId(locationId)) throw new Error("Enter a name, valid email, assigned branch and a password of 12–128 characters.");
    const branch = await session.from("locations").select("id").eq("id", locationId).eq("business_id", business.id).eq("is_central", false).single();
    if (branch.error || !branch.data) throw new Error("Choose a branch in this business.");
    let admin: ReturnType<typeof createSupabaseAdmin>;
    try { admin = createSupabaseAdmin(); } catch { throw new AccessError("Account creation is not configured on this server.", 503); }
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Unable to create account.");
    const assigned = await admin.rpc("assign_new_business_user", { p_business_id: business.id, p_actor_id: user.id, p_user_id: created.data.user.id, p_name: fullName, p_role: role, p_location_id: locationId });
    if (assigned.error || assigned.data !== true) {
      // A remote assignment may have committed even if its response was lost.
      throw new AccessError("Account setup could not be confirmed. Check User Access before retrying; the login has been preserved for review.", 503);
    }
    return Response.json({ id: created.data.user.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
