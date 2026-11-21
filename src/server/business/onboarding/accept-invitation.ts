import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { hasSameOrigin } from "@/lib/request-origin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { businessWorkspacesEnabled, validBusinessId } from "@/features/workspaces/context";

// The invited business admin redeems a platform-issued link on the business
// application. All checks are repeated in service-only database functions.
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const rejected = "This invitation could not be completed. Contact the platform administrator for help.";

class AcceptanceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function fail(error: unknown) {
  const known = error instanceof AcceptanceError;
  return Response.json({ error: known ? error.message : "Unable to complete this request. Please try again later." }, { status: known ? error.status : 503, headers: privateHeaders });
}

async function input(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 4096) throw new AcceptanceError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AcceptanceError("Invalid request.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new AcceptanceError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AcceptanceError("Invalid request.", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AcceptanceError("Invalid request.", 400);
  return value as Record<string, unknown>;
}

function digest(token: string) { return createHash("sha256").update(token, "utf8").digest("hex"); }
type InvitationClaim = { invitation_id?: unknown; email?: unknown; name?: unknown };

/** Fail-closed: once claimed, uncertain Auth or database outcomes need operator review. */
export async function acceptOwnerInvitation(request: Request) {
  try {
    if (!businessWorkspacesEnabled() || process.env.BUSINESS_OWNER_ACCEPTANCE_ENABLED !== "true") throw new AcceptanceError("Not found.", 404);
    if (!hasSameOrigin(request)) throw new AcceptanceError("Request not allowed.", 403);
    const values = await input(request);
    const token = typeof values.token === "string" ? values.token : "";
    const password = typeof values.password === "string" ? values.password : "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password.length < 12 || password.length > 128) throw new AcceptanceError(rejected, 400);
    let admin: ReturnType<typeof createSupabaseAdmin>;
    try { admin = createSupabaseAdmin(); } catch { throw new AcceptanceError(rejected, 503); }
    const claimId = randomUUID();
    let claim: InvitationClaim | null = null;
    try {
      const result = await admin.rpc("platform_claim_owner_invitation", { p_token_hash: digest(token), p_claim_id: claimId });
      if (result.error) throw result.error;
      claim = result.data as InvitationClaim | null;
    } catch { throw new AcceptanceError(rejected, 503); }
    if (!claim || !validBusinessId(String(claim.invitation_id ?? "")) || typeof claim.email !== "string" || typeof claim.name !== "string") throw new AcceptanceError(rejected, 400);
    let created: Awaited<ReturnType<typeof admin.auth.admin.createUser>>;
    try { created = await admin.auth.admin.createUser({ email: claim.email, password, email_confirm: true, user_metadata: { full_name: claim.name } }); }
    catch { throw new AcceptanceError(rejected, 409); }
    if (created.error || !created.data.user) {
      // A definite 4xx means no login was created: return the claim so the link stays usable.
      // Anything else may have created a login, so the invitation stays held for platform review.
      const status = typeof created.error?.status === "number" ? created.error.status : 0;
      if (status >= 400 && status < 500) {
        let released = false;
        try {
          const result = await admin.rpc("platform_release_owner_invitation", { p_invitation_id: claim.invitation_id, p_claim_id: claimId });
          released = !result.error && result.data === true;
        } catch { released = false; }
        if (released && created.error?.code === "weak_password") throw new AcceptanceError("Choose a stronger password and try again.", 400);
      }
      throw new AcceptanceError(rejected, 409);
    }
    const userId = created.data.user.id;
    try {
      const assigned = await admin.rpc("platform_complete_owner_invitation", { p_invitation_id: claim.invitation_id, p_claim_id: claimId, p_user_id: userId });
      if (assigned.error || assigned.data !== true) throw new Error();
    } catch { throw new AcceptanceError("Your account may already be set up. Ask your platform administrator to confirm before trying again.", 503); }
    return Response.json({ accepted: true }, { status: 201, headers: privateHeaders });
  } catch (error) { return fail(error); }
}
