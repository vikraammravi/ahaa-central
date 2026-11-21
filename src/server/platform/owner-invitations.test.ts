import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { db, queryResult } from "@tests/mocks/supabase";
import { exampleAdmin, invitationBusinessId, invitationUserId } from "@tests/mocks/platform-invitations";
import { issueOwnerInvitation, resolveOwnerInvitation, revokeOwnerInvitation } from "./owner-invitations";
import * as inviteRoute from "@/app/api/platform/businesses/[id]/owner/invite/route";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
const privileged = vi.hoisted(() => ({ rpc: vi.fn(), auth: { admin: { createUser: vi.fn() } } }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn(() => privileged) }));

function request(body: unknown, { origin = "https://app.example", method = "POST" } = {}) {
  return new Request("https://app.example/api", { method, headers: { origin, host: "app.example", "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const context = (id = invitationBusinessId) => ({ params: Promise.resolve({ id }) });
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const rpcNames = () => db.rpc.mock.calls.map(([name]) => name);
function rpcFails(name: string, code: string) {
  db.rpc.mockImplementation((called: string) => called === "platform_is_administrator" ? queryResult(true) : called === name ? queryResult(null, { message: "private database detail", code } as { message: string }) : queryResult(null));
}

beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
  vi.stubEnv("BUSINESS_APP_ORIGIN", "https://business.example");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: invitationUserId } }, error: null });
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : name === "platform_revoke_owner_invitation" ? true : "2026-12-01T00:00:00Z"));
});

it("routes POST to issuance, DELETE to revocation and PATCH to resolution", () => {
  expect(inviteRoute.POST).toBe(issueOwnerInvitation);
  expect(inviteRoute.DELETE).toBe(revokeOwnerInvitation);
  expect(inviteRoute.PATCH).toBe(resolveOwnerInvitation);
});

describe("issueOwnerInvitation", () => {
  it("returns the secret once in a URL fragment and sends only its SHA-256 hash to the database", async () => {
    const response = await issueOwnerInvitation(request({ name: "  Test owner ", email: " Owner@Example.INVALID " }), context());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "invitationUrl"]);
    expect(body.expiresAt).toBe("2026-12-01T00:00:00Z");
    const url = new URL(body.invitationUrl);
    expect(url.origin + url.pathname).toBe("https://business.example/accept-invite");
    expect(url.search).toBe("");
    const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.rpc).toHaveBeenCalledWith("platform_issue_owner_invitation", { p_business_id: invitationBusinessId, p_name: "Test owner", p_email: exampleAdmin.email, p_token_hash: hash(token) });
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(token);
    expect(privileged.rpc).not.toHaveBeenCalled();
    expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("generates a different secret for each issuance (reissue replaces the link)", async () => {
    const first = (await (await issueOwnerInvitation(request(exampleAdmin), context())).json()).invitationUrl;
    const second = (await (await issueOwnerInvitation(request(exampleAdmin), context())).json()).invitationUrl;
    expect(first).not.toBe(second);
  });

  it("rejects an email that already has an account with guidance to use Existing account", async () => {
    rpcFails("platform_issue_owner_invitation", "23505");
    const response = await issueOwnerInvitation(request(exampleAdmin), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "An account with this email already exists. Use Existing account instead." });
  });

  it.each([
    ["42501", 403, "Platform access is required."],
    ["P0001", 409, "Unable to issue an invitation. Check the business setup or wait before trying again."],
  ])("maps database error %s safely", async (code, status, message) => {
    rpcFails("platform_issue_owner_invitation", code);
    const response = await issueOwnerInvitation(request(exampleAdmin), context());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it("does not return a link when the database does not confirm an expiry", async () => {
    db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : null));
    const response = await issueOwnerInvitation(request(exampleAdmin), context());
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("accept-invite");
  });

  it("refuses cross-origin, disabled, non-platform and unsafe-origin issuance before issuing", async () => {
    expect((await issueOwnerInvitation(request(exampleAdmin, { origin: "https://other.example" }), context())).status).toBe(403);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "false");
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(409);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "false");
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(409);
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
    vi.stubEnv("BUSINESS_APP_ORIGIN", "https://business.example/some-path");
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(503);
    vi.stubEnv("BUSINESS_APP_ORIGIN", "http://business.example");
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(503);
    vi.stubEnv("BUSINESS_APP_ORIGIN", "https://business.example");
    db.rpc.mockReturnValue(queryResult(false));
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(403);
    expect(rpcNames()).not.toContain("platform_issue_owner_invitation");
  });

  it("is unavailable on the business deployment", async () => {
    vi.stubEnv("APP_SURFACE", "business");
    expect((await issueOwnerInvitation(request(exampleAdmin), context())).status).toBe(404);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "", email: "owner@example.invalid" }, invitationBusinessId],
    [{ name: "Owner", email: "not-an-email" }, invitationBusinessId],
    [{ name: "x".repeat(201), email: "owner@example.invalid" }, invitationBusinessId],
    [exampleAdmin, "../admin"],
  ])("rejects invalid details %# before issuing", async (body, id) => {
    expect((await issueOwnerInvitation(request(body), context(id))).status).toBe(400);
    expect(rpcNames()).not.toContain("platform_issue_owner_invitation");
  });

  it("rejects oversized bodies", async () => {
    expect((await issueOwnerInvitation(request({ ...exampleAdmin, padding: "x".repeat(5000) }), context())).status).toBe(413);
    expect(rpcNames()).not.toContain("platform_issue_owner_invitation");
  });
});

describe("revokeOwnerInvitation", () => {
  const revoke = (options: { origin?: string } = {}, id?: string) => revokeOwnerInvitation(request(undefined, { method: "DELETE", ...options }), context(id));

  it("revokes the unused invitation through the platform RPC", async () => {
    const response = await revoke();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ revoked: true });
    expect(db.rpc).toHaveBeenCalledWith("platform_revoke_owner_invitation", { p_business_id: invitationBusinessId });
  });

  it("returns 404 when there is no unused invitation to revoke", async () => {
    db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : false));
    const response = await revoke();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "There is no unused invitation to revoke." });
  });

  it.each([["42501", 403], ["P0001", 409]])("maps database error %s without leaking details", async (code, status) => {
    rpcFails("platform_revoke_owner_invitation", code);
    const response = await revoke();
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("private database detail");
  });

  it("refuses cross-origin, non-platform, invalid-ID and disabled revocation before the RPC", async () => {
    expect((await revoke({ origin: "https://other.example" })).status).toBe(403);
    expect((await revoke({}, "../admin")).status).toBe(400);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "false");
    expect((await revoke()).status).toBe(409);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
    db.rpc.mockReturnValue(queryResult(false));
    expect((await revoke()).status).toBe(403);
    expect(rpcNames()).not.toContain("platform_revoke_owner_invitation");
  });

  it("requires sign-in and is unavailable when the console is off", async () => {
    db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await revoke()).status).toBe(401);
    vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "false");
    expect((await revoke()).status).toBe(404);
    expect(rpcNames()).not.toContain("platform_revoke_owner_invitation");
  });
});

describe("resolveOwnerInvitation", () => {
  const resolve = (options: { origin?: string } = {}, id?: string) => resolveOwnerInvitation(request(undefined, { method: "PATCH", ...options }), context(id));
  const resolvesTo = (data: unknown) => db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : data));

  it.each(["completed", "revoked"])("returns the %s outcome from the platform RPC", async outcome => {
    resolvesTo(outcome);
    const response = await resolve();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ outcome });
    expect(db.rpc).toHaveBeenCalledWith("platform_resolve_owner_invitation", { p_business_id: invitationBusinessId });
  });

  it.each(["none", null, true, "processing"])("returns 404 when there is nothing to resolve (%s)", async data => {
    resolvesTo(data);
    const response = await resolve();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "There is no interrupted invitation to resolve." });
  });

  it.each([["42501", 403, "Platform access is required."], ["55000", 409, "Setup is still in progress. Try again in a few minutes."], ["P0001", 409, "Unable to resolve the invitation. Please try again."]])("maps database error %s to a safe message", async (code, status, message) => {
    rpcFails("platform_resolve_owner_invitation", code);
    const response = await resolve();
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it("refuses cross-origin, invalid-ID, disabled and non-platform resolution before the RPC", async () => {
    expect((await resolve({ origin: "https://other.example" })).status).toBe(403);
    expect((await resolve({}, "../admin")).status).toBe(400);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "false");
    expect((await resolve()).status).toBe(409);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "false");
    expect((await resolve()).status).toBe(409);
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
    db.rpc.mockReturnValue(queryResult(false));
    expect((await resolve()).status).toBe(403);
    vi.stubEnv("APP_SURFACE", "business");
    expect((await resolve()).status).toBe(404);
    expect(rpcNames()).not.toContain("platform_resolve_owner_invitation");
  });
});
