import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { hasSameOrigin } from "@/lib/request-origin";
import { validBusinessId } from "@/features/workspaces/context";
import { PlatformAccessError, platformSession } from "./access";

const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

function fail(error: unknown) {
  const known = error instanceof PlatformAccessError;
  return Response.json({ error: known ? error.message : "Unable to complete this request. Please try again later." }, { status: known ? error.status : 503, headers: privateHeaders });
}

async function input(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 4096) throw new PlatformAccessError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PlatformAccessError("Invalid request.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new PlatformAccessError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new PlatformAccessError("Invalid request.", 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PlatformAccessError("Invalid request.", 400);
  return value as Record<string, unknown>;
}

function businessOrigin(): string {
  try {
    const url = new URL(process.env.BUSINESS_APP_ORIGIN || "");
    const local = process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url.origin;
  } catch { throw new PlatformAccessError("Business app address is not configured.", 503); }
}

function invitationsEnabled() {
  return process.env.PLATFORM_BUSINESS_REGISTRATION_ENABLED === "true" && process.env.PLATFORM_OWNER_INVITATIONS_ENABLED === "true";
}

function digest(token: string) { return createHash("sha256").update(token, "utf8").digest("hex"); }

/** The only returned secret is the single-use link, shown once to a platform admin. Issuing replaces an unused link. */
export async function issueOwnerInvitation(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (!invitationsEnabled()) throw new PlatformAccessError("Admin invitations are not enabled yet.", 409);
    const origin = businessOrigin();
    const { id } = await context.params;
    const values = await input(request);
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    if (!validBusinessId(id) || !name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PlatformAccessError("Enter a business, admin name and valid email.", 400);
    const token = randomBytes(32).toString("base64url");
    const result = await session.rpc("platform_issue_owner_invitation", { p_business_id: id, p_name: name, p_email: email, p_token_hash: digest(token) });
    if (result.error) {
      if (result.error.code === "23505") throw new PlatformAccessError("An account with this email already exists. Use Existing account instead.", 409);
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw new PlatformAccessError("Unable to issue an invitation. Check the business setup or wait before trying again.", 409);
    }
    if (typeof result.data !== "string") throw new PlatformAccessError("Unable to issue an invitation. Check the business setup or contact support.", 409);
    // Fragment is not sent in HTTP requests, referrer headers or server access logs.
    const invitationUrl = `${origin}/accept-invite#token=${token}`;
    return Response.json({ invitationUrl, expiresAt: result.data }, { status: 201, headers: privateHeaders });
  } catch (error) { return fail(error); }
}

/**
 * Recovers an invitation whose redemption was interrupted: finishes the admin setup when
 * the invitee's login exists, otherwise cancels it so a new link can be issued.
 */
export async function resolveOwnerInvitation(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (!invitationsEnabled()) throw new PlatformAccessError("Admin invitations are not enabled yet.", 409);
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new PlatformAccessError("Choose a valid business.", 400);
    const result = await session.rpc("platform_resolve_owner_invitation", { p_business_id: id });
    if (result.error) {
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      if (result.error.code === "55000") throw new PlatformAccessError("Setup is still in progress. Try again in a few minutes.", 409);
      throw new PlatformAccessError("Unable to resolve the invitation. Please try again.", 409);
    }
    if (result.data !== "completed" && result.data !== "revoked") throw new PlatformAccessError("There is no interrupted invitation to resolve.", 404);
    return Response.json({ outcome: result.data }, { headers: privateHeaders });
  } catch (error) { return fail(error); }
}

/** Revokes an unused link. A link already being redeemed is left for review rather than silently cancelled. */
export async function revokeOwnerInvitation(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasSameOrigin(request)) throw new PlatformAccessError("Request not allowed.", 403);
    const session = await platformSession();
    if (!invitationsEnabled()) throw new PlatformAccessError("Admin invitations are not enabled yet.", 409);
    const { id } = await context.params;
    if (!validBusinessId(id)) throw new PlatformAccessError("Choose a valid business.", 400);
    const result = await session.rpc("platform_revoke_owner_invitation", { p_business_id: id });
    if (result.error) {
      if (result.error.code === "42501") throw new PlatformAccessError("Platform access is required.", 403);
      throw new PlatformAccessError("Unable to revoke the invitation. Please try again.", 409);
    }
    if (result.data !== true) throw new PlatformAccessError("There is no unused invitation to revoke.", 404);
    return Response.json({ revoked: true }, { headers: privateHeaders });
  } catch (error) { return fail(error); }
}
