export type OwnerInvitationState = "issued" | "processing" | "completed" | "revoked";
export type OwnerInvitation = { name: string; email: string; state: OwnerInvitationState; created_at: string; expires_at: string; completed_at: string | null };
export type PlatformBusiness = { id: string; name: string; slug: string; status: "provisioning" | "active" | "suspended"; isolation_ready: boolean; owner_assigned: boolean; created_at: string; invitation?: OwnerInvitation | null };
export type PlatformDirectory = { businesses: PlatformBusiness[]; invitationsUnavailable: boolean };

async function send<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || fallback);
  return result as T;
}
const json = { "Content-Type": "application/json" };
const businessPath = (businessId: string) => `/api/platform/businesses/${encodeURIComponent(businessId)}`;

export async function fetchBusinesses(signal: AbortSignal): Promise<PlatformDirectory> {
  const result = await send<{ businesses: PlatformBusiness[]; invitationsUnavailable?: boolean }>("/api/platform/businesses", { signal }, "Unable to load businesses.");
  return { businesses: result.businesses, invitationsUnavailable: result.invitationsUnavailable === true };
}
export async function registerBusiness(name: string, slug: string): Promise<void> {
  await send("/api/platform/businesses", { method: "POST", headers: json, body: JSON.stringify({ name, slug }) }, "Unable to create business.");
}
export async function activateBusiness(businessId: string): Promise<void> {
  await send(`${businessPath(businessId)}/activate`, { method: "POST" }, "Unable to activate business.");
}
export async function assignBusinessOwner(businessId: string, email: string): Promise<void> {
  await send(`${businessPath(businessId)}/owner`, { method: "POST", headers: json, body: JSON.stringify({ email }) }, "Unable to assign the business admin.");
}
export async function inviteBusinessOwner(businessId: string, name: string, email: string): Promise<{ invitationUrl: string; expiresAt: string }> {
  return send(`${businessPath(businessId)}/owner/invite`, { method: "POST", headers: json, body: JSON.stringify({ name, email }) }, "Unable to create the invitation.");
}
export async function revokeBusinessInvitation(businessId: string): Promise<void> {
  await send(`${businessPath(businessId)}/owner/invite`, { method: "DELETE" }, "Unable to revoke the invitation.");
}

export async function resolveBusinessInvitation(businessId: string): Promise<"completed" | "revoked"> {
  const result = await send<{ outcome: "completed" | "revoked" }>(`${businessPath(businessId)}/owner/invite`, { method: "PATCH" }, "Unable to resolve the invitation.");
  return result.outcome;
}

export type AttentionReason = "interrupted" | "ready" | "expired" | "expiring" | "no-admin";
export type AttentionItem = { business: PlatformBusiness; reason: AttentionReason };
const ATTENTION_ORDER: AttentionReason[] = ["interrupted", "ready", "expired", "expiring", "no-admin"];
/** Businesses in setup that need a platform action, most urgent first. */
export function attentionItems(businesses: PlatformBusiness[], now = Date.now(), statusUnknown = false): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const business of businesses) {
    if (business.status !== "provisioning" || business.isolation_ready) continue;
    if (business.owner_assigned) { items.push({ business, reason: "ready" }); continue; }
    if (statusUnknown) continue;
    const status = invitationStatus(business.invitation, now);
    if (status === "review") items.push({ business, reason: "interrupted" });
    else if (status === "expired") items.push({ business, reason: "expired" });
    else if (status === "pending" && new Date(business.invitation!.expires_at).getTime() - now < 6 * 60 * 60 * 1000) items.push({ business, reason: "expiring" });
    else if (status === "none" || status === "revoked") items.push({ business, reason: "no-admin" });
  }
  return items.sort((a, b) => ATTENTION_ORDER.indexOf(a.reason) - ATTENTION_ORDER.indexOf(b.reason) || a.business.name.localeCompare(b.business.name));
}

export type InvitationStatus = "none" | "pending" | "expired" | "review" | "accepted" | "revoked";
/** Display state for the latest invitation; "review" means a redemption outcome needs an operator. */
export function invitationStatus(invitation: OwnerInvitation | null | undefined, now = Date.now()): InvitationStatus {
  if (!invitation) return "none";
  if (invitation.state === "completed") return "accepted";
  if (invitation.state === "processing") return "review";
  if (invitation.state === "revoked") return "revoked";
  return new Date(invitation.expires_at).getTime() <= now ? "expired" : "pending";
}
