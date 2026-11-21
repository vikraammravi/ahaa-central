import "server-only";
import { hasSameOrigin } from "@/lib/request-origin";
import { PlatformAccessError, platformSession } from "./access";
import { validBusinessId } from "@/features/workspaces/context";

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
type InvitationSummary = { business_id: string; name: string; email: string; state: string; created_at: string; expires_at: string; completed_at: string | null };
// Latest invitation per business, without secrets. Optional: the directory still loads if it is unavailable.
async function invitationSummaries(session: Awaited<ReturnType<typeof platformSession>>, businessIds: string[]): Promise<Map<string, InvitationSummary> | null> {
  if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true" || process.env.PLATFORM_OWNER_INVITATIONS_ENABLED !== "true" || !businessIds.length) return new Map();
  try {
    const result = await session.rpc("platform_owner_invitation_summary", { p_business_ids: businessIds });
    if (result.error || !Array.isArray(result.data)) return null;
    return new Map((result.data as InvitationSummary[]).map(row => [row.business_id, row]));
  } catch { return null; }
}
export async function listBusinesses() {
  try {
    const session = await platformSession();
    const { data, error } = await session.from("businesses").select("id,name,slug,status,isolation_ready,created_at,business_memberships(role)").order("name").limit(100);
    if (error) throw error;
    const invitations = await invitationSummaries(session, (data ?? []).map(business => business.id));
    const businesses = (data ?? []).map(({ business_memberships, ...business }) => {
      const invitation = invitations?.get(business.id);
      return {
        ...business,
        owner_assigned: Array.isArray(business_memberships) && business_memberships.some(member => member.role === "CENTRAL_ADMIN"),
        invitation: invitation ? { name: invitation.name, email: invitation.email, state: invitation.state, created_at: invitation.created_at, expires_at: invitation.expires_at, completed_at: invitation.completed_at } : null,
      };
    });
    return Response.json({ businesses, invitationsUnavailable: invitations === null }, { headers });
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
    if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true" || process.env.PLATFORM_OWNER_ASSIGNMENT_ENABLED !== "true") throw new PlatformAccessError("Admin assignment is not enabled yet.", 409);
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

export async function activateBusiness(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED !== "true" || process.env.PLATFORM_BUSINESS_ACTIVATION_ENABLED !== "true") throw new PlatformAccessError("Business activation is not enabled yet.", 409);
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new PlatformAccessError("Choose a valid business.", 400);
    const result = await session.rpc("activate_platform_business", { p_business_id: id });
    if (result.error) {
      if (result.error.code === "P0002") throw new PlatformAccessError("Business not found.", 404);
      if (result.error.code === "55000") throw new PlatformAccessError("This business is not ready for activation. Check the assigned admin and isolation setup.", 409);
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw result.error;
    }
    return Response.json({ business: result.data }, { headers });
  } catch (error) { return failure(error); }
}
