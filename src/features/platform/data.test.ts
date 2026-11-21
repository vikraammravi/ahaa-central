import { beforeEach, expect, it, vi } from "vitest";
import { acceptedInvitation, businessWithInvitation, expiredInvitation, ownerAssignedBusiness, pendingInvitation, platformBusinesses, reviewInvitation, revokedInvitation } from "@tests/mocks/platform";
import { attentionItems, fetchBusinesses, invitationStatus, inviteBusinessOwner, resolveBusinessInvitation, revokeBusinessInvitation } from "./data";

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); });
const reply = (ok: boolean, body: unknown) => fetchMock.mockResolvedValueOnce({ ok, json: async () => body });

it("treats a missing invitation as none", () => {
  expect(invitationStatus(null)).toBe("none");
  expect(invitationStatus(undefined)).toBe("none");
});

it("maps terminal and in-progress states regardless of expiry", () => {
  const past = Date.parse("2100-01-01T00:00:00Z");
  expect(invitationStatus(acceptedInvitation, past)).toBe("accepted");
  expect(invitationStatus(reviewInvitation, past)).toBe("review");
  expect(invitationStatus(revokedInvitation, past)).toBe("revoked");
});

it("expires an issued invitation exactly at its expiry time", () => {
  const expiry = Date.parse(pendingInvitation.expires_at);
  expect(invitationStatus(pendingInvitation, expiry - 1)).toBe("pending");
  expect(invitationStatus(pendingInvitation, expiry)).toBe("expired");
  expect(invitationStatus(pendingInvitation, expiry + 1)).toBe("expired");
});

it("returns the directory with an explicit invitation availability flag", async () => {
  reply(true, { businesses: platformBusinesses });
  expect(await fetchBusinesses(new AbortController().signal)).toEqual({ businesses: platformBusinesses, invitationsUnavailable: false });
  reply(true, { businesses: platformBusinesses, invitationsUnavailable: true });
  expect((await fetchBusinesses(new AbortController().signal)).invitationsUnavailable).toBe(true);
  reply(true, { businesses: [], invitationsUnavailable: "yes" });
  expect((await fetchBusinesses(new AbortController().signal)).invitationsUnavailable).toBe(false);
  expect(fetchMock).toHaveBeenCalledWith("/api/platform/businesses", expect.objectContaining({ cache: "no-store" }));
});

it("revokes through DELETE on the encoded invite path and surfaces server errors", async () => {
  reply(true, { revoked: true });
  await revokeBusinessInvitation("a/b");
  expect(fetchMock).toHaveBeenCalledWith("/api/platform/businesses/a%2Fb/owner/invite", expect.objectContaining({ method: "DELETE", cache: "no-store" }));
  reply(false, { error: "There is no unused invitation to revoke." });
  await expect(revokeBusinessInvitation("b")).rejects.toThrow("There is no unused invitation to revoke.");
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => { throw new Error("not json"); } });
  await expect(revokeBusinessInvitation("b")).rejects.toThrow("Unable to revoke the invitation.");
});

it("passes the existing-account guidance from issuance through to the caller", async () => {
  reply(false, { error: "An account with this email already exists. Use Existing account instead." });
  await expect(inviteBusinessOwner("b", "Owner", "owner@example.invalid")).rejects.toThrow("Use Existing account instead.");
  expect(fetchMock).toHaveBeenCalledWith("/api/platform/businesses/b/owner/invite", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Owner", email: "owner@example.invalid" }) }));
});

it("resolves an interrupted invitation through PATCH and returns the outcome", async () => {
  reply(true, { outcome: "completed" });
  expect(await resolveBusinessInvitation("a/b")).toBe("completed");
  expect(fetchMock).toHaveBeenCalledWith("/api/platform/businesses/a%2Fb/owner/invite", expect.objectContaining({ method: "PATCH", cache: "no-store" }));
  reply(true, { outcome: "revoked" });
  expect(await resolveBusinessInvitation("b")).toBe("revoked");
  reply(false, { error: "There is no interrupted invitation to resolve." });
  await expect(resolveBusinessInvitation("b")).rejects.toThrow("There is no interrupted invitation to resolve.");
});

const hour = 60 * 60 * 1000;
const now = Date.parse("2026-11-20T12:00:00Z");
const expiringAt = (ms: number) => ({ ...pendingInvitation, expires_at: new Date(now + ms).toISOString() });
const reasons = (items: ReturnType<typeof attentionItems>) => items.map(item => [item.business.name, item.reason]);

it("orders attention items interrupted, ready, expired, expiring, then no admin, by name within a reason", () => {
  const businesses = [
    businessWithInvitation(null, { id: "1", name: "Zeta" }),
    businessWithInvitation(revokedInvitation, { id: "2", name: "Alpha" }),
    businessWithInvitation(expiringAt(hour), { id: "3", name: "Soon" }),
    businessWithInvitation(expiringAt(-1), { id: "4", name: "Gone" }),
    { ...ownerAssignedBusiness, id: "5", name: "Ready B", invitation: acceptedInvitation },
    { ...ownerAssignedBusiness, id: "6", name: "Ready A" },
    businessWithInvitation(reviewInvitation, { id: "7", name: "Stuck" }),
  ];
  expect(reasons(attentionItems(businesses, now))).toEqual([
    ["Stuck", "interrupted"], ["Ready A", "ready"], ["Ready B", "ready"], ["Gone", "expired"], ["Soon", "expiring"], ["Alpha", "no-admin"], ["Zeta", "no-admin"],
  ]);
});

it("treats an invitation as expiring strictly inside six hours", () => {
  const items = (ms: number) => reasons(attentionItems([businessWithInvitation(expiringAt(ms))], now));
  expect(items(6 * hour - 1)).toEqual([["Example Business", "expiring"]]);
  expect(items(6 * hour)).toEqual([]);
  expect(items(1)).toEqual([["Example Business", "expiring"]]);
  expect(items(0)).toEqual([["Example Business", "expired"]]);
});

it("skips active, suspended, isolated, accepted-without-owner and comfortably pending businesses", () => {
  const businesses = [
    platformBusinesses[0],
    { ...platformBusinesses[1], id: "s", status: "suspended" as const },
    { ...ownerAssignedBusiness, id: "iso", isolation_ready: true },
    businessWithInvitation(acceptedInvitation, { id: "acc" }),
    businessWithInvitation(pendingInvitation, { id: "far" }),
    businessWithInvitation(expiredInvitation, { id: "x", status: "active" }),
  ];
  expect(attentionItems(businesses, now)).toEqual([]);
  expect(attentionItems([], now)).toEqual([]);
});

it("keeps only ready items when invitation status is unknown", () => {
  const businesses = [
    businessWithInvitation(reviewInvitation, { id: "1", name: "Stuck" }),
    businessWithInvitation(null, { id: "2", name: "Empty" }),
    businessWithInvitation(expiredInvitation, { id: "3", name: "Gone" }),
    { ...ownerAssignedBusiness, id: "4", name: "Ready" },
  ];
  expect(reasons(attentionItems(businesses, now, true))).toEqual([["Ready", "ready"]]);
});
