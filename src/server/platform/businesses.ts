import "server-only";
import { hasSameOrigin } from "@/lib/request-origin";
import { PlatformAccessError, platformSession } from "./access";
import { validBusinessId } from "@/features/workspaces/context";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const known = error instanceof PlatformAccessError;
  return Response.json({ error: known ? error.message : "Unable to manage businesses. Please try again." }, { status: known ? error.status : 503, headers });
}
async function requestBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 4096) throw new PlatformAccessError("Business details are too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PlatformAccessError("Invalid business details.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new PlatformAccessError("Business details are too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let input: unknown;
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new PlatformAccessError("Invalid business details.", 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformAccessError("Invalid business details.", 400);
  return input as Record<string, unknown>;
}
export async function listBusinesses() {
  try {
    const session = await platformSession();
    const { data, error } = await session.from("businesses").select("id,name,slug,status,isolation_ready,created_at,business_memberships(role)").order("name").limit(100);
    if (error) throw error;
    const businesses = (data ?? []).map(({ business_memberships, ...business }) => ({
      ...business,
      owner_assigned: Array.isArray(business_memberships) && business_memberships.some(member => member.role === "CENTRAL_ADMIN"),
    }));
    return Response.json({ businesses }, { headers });
  } catch (error) { return failure(error); }
}
export async function createBusiness(request: Request) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true") throw new PlatformAccessError("Business registration is not enabled yet.", 409);
    const values = await requestBody(request);
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const slug = typeof values.slug === "string" ? values.slug.trim() : "";
    if (!name || name.length > 200 || slug.length < 2 || slug.length > 60 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new PlatformAccessError("Enter a business name and a lowercase address using letters, numbers and hyphens.", 400);
    const result = await session.rpc("platform_create_business", { p_name: name, p_slug: slug });
    if (result.error) {
      if (result.error.code === "23505") throw new PlatformAccessError("That business address is already in use.", 409);
      throw result.error;
    }
    return Response.json({ business: result.data }, { status: 201, headers });
  } catch (error) { return failure(error); }
}
export async function assignInitialOwner(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true") throw new PlatformAccessError("Business registration is not enabled yet.", 409);
    const { id } = await context.params;
    const values = await requestBody(request);
    const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    if (!validBusinessId(id) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PlatformAccessError("Choose a business and enter a valid email.", 400);
    const result = await session.rpc("platform_assign_initial_owner", { p_business_id: id, p_email: email });
    if (result.error) {
      if (result.error.code === "P0002") throw new PlatformAccessError("An active account with this email was not found.", 404);
      if (result.error.code === "P0003") throw new PlatformAccessError("More than one active account matches this email. Contact support.", 409);
      if (result.error.code === "23505") throw new PlatformAccessError("An initial admin has already been assigned.", 409);
      if (result.error.code === "55000") throw new PlatformAccessError("This business is not ready for admin assignment.", 409);
      throw result.error;
    }
    return Response.json({ assigned: true }, { headers });
  } catch (error) { return failure(error); }
}

export async function createInitialOwner(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true" || process.env.PLATFORM_NEW_OWNER_CREATION_ENABLED !== "true") throw new PlatformAccessError("New account setup is not enabled yet.", 409);
    const { id } = await context.params;
    const values = await requestBody(request);
    const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const password = typeof values.password === "string" ? values.password : "";
    if (!validBusinessId(id) || !name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) throw new PlatformAccessError("Enter a name, valid email and a password of 12–128 characters.", 400);
    const actor = await session.auth.getUser();
    if (actor.error || !actor.data.user) throw new PlatformAccessError("Sign in to continue.", 401);
    const ready = await session.rpc("platform_can_create_owner", { p_business_id: id });
    if (ready.error || ready.data !== true) throw new PlatformAccessError("This business is not ready for new account setup.", 409);
    let admin: ReturnType<typeof createSupabaseAdmin>;
    try { admin = createSupabaseAdmin(); } catch { throw new PlatformAccessError("Account creation is not configured.", 503); }
    let created: Awaited<ReturnType<typeof admin.auth.admin.createUser>>;
    try { created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } }); }
    catch { throw new PlatformAccessError("Account creation could not be confirmed. Review the account before retrying.", 503); }
    if (created.error || !created.data.user) throw new PlatformAccessError("Account creation could not be confirmed. Check whether the email already has an account before retrying.", 409);
    let assigned: Awaited<ReturnType<typeof admin.rpc>>;
    try { assigned = await admin.rpc("platform_assign_new_owner", { p_business_id: id, p_actor_id: actor.data.user.id, p_user_id: created.data.user.id, p_name: name }); }
    catch { throw new PlatformAccessError("Account setup could not be confirmed. Review the account before retrying; the login has been preserved.", 503); }
    // Never delete a login after an uncertain remote response: assignment may have committed.
    if (assigned.error || assigned.data !== true) throw new PlatformAccessError("Account setup could not be confirmed. Review the account before retrying; the login has been preserved.", 503);
    return Response.json({ assigned: true }, { status: 201, headers });
  } catch (error) { return failure(error); }
}
