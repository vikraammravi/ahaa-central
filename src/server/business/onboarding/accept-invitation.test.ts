import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { exampleAdmin, examplePassword, exampleToken, invitationId, invitationUserId } from "@tests/mocks/platform-invitations";
import { acceptOwnerInvitation as handler } from "./accept-invitation";
import { acceptOwnerInvitation } from "./endpoints";
import { POST } from "@/app/api/onboarding/accept/route";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const privileged = vi.hoisted(() => ({ rpc: vi.fn(), auth: { admin: { createUser: vi.fn() } } }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn(() => privileged) }));

const rejected = "This invitation could not be completed. Contact the platform administrator for help.";
const mayBeSetUp = "Your account may already be set up. Ask your platform administrator to confirm before trying again.";
const valid = { token: exampleToken, password: examplePassword };
function request(body: unknown, origin = "https://business.example") {
  return new Request("https://business.example/api/onboarding/accept", { method: "POST", headers: { origin, host: "business.example", "content-type": "application/json" }, body: JSON.stringify(body) });
}
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const rpcNames = () => privileged.rpc.mock.calls.map(([name]) => name);
async function expectRejected(response: Response, status: number, message = rejected) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const text = await response.text();
  expect(JSON.parse(text)).toEqual({ error: message });
  for (const secret of [exampleToken, examplePassword, "private"]) expect(text).not.toContain(secret);
}

beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.stubEnv("BUSINESS_OWNER_ACCEPTANCE_ENABLED", "true");
  privileged.rpc.mockImplementation(async (name: string) => ({ data: name === "platform_claim_owner_invitation" ? { invitation_id: invitationId, ...exampleAdmin } : true, error: null }));
  privileged.auth.admin.createUser.mockResolvedValue({ data: { user: { id: invitationUserId } }, error: null });
});

it("exposes the business-wrapped handler from the onboarding route", () => {
  expect(POST).toBe(acceptOwnerInvitation);
});

it("claims by token hash, creates the account with the admin's own password, then completes the same claim", async () => {
  const response = await POST(request(valid));
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const text = await response.text();
  expect(JSON.parse(text)).toEqual({ accepted: true });
  expect(text).not.toContain(examplePassword);
  const [claim, complete] = privileged.rpc.mock.calls;
  expect(claim[0]).toBe("platform_claim_owner_invitation");
  expect(claim[1]).toEqual({ p_token_hash: hash(exampleToken), p_claim_id: expect.any(String) });
  expect(JSON.stringify(privileged.rpc.mock.calls)).not.toContain(exampleToken);
  expect(privileged.auth.admin.createUser).toHaveBeenCalledWith({ email: exampleAdmin.email, password: examplePassword, email_confirm: true, user_metadata: { full_name: exampleAdmin.name } });
  expect(complete).toEqual(["platform_complete_owner_invitation", { p_invitation_id: invitationId, p_claim_id: claim[1].p_claim_id, p_user_id: invitationUserId }]);
});

it("is not found on the platform surface even when acceptance flags are on", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  const response = await POST(request(valid));
  expect(response.status).toBe(404);
  expect(createSupabaseAdmin).not.toHaveBeenCalled();
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
});

it.each([
  ["workspaces off", "NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED"],
  ["acceptance flag off", "BUSINESS_OWNER_ACCEPTANCE_ENABLED"],
])("is not found with %s", async (_label, flag) => {
  vi.stubEnv(flag, "false");
  expect((await POST(request(valid))).status).toBe(404);
  expect(createSupabaseAdmin).not.toHaveBeenCalled();
});

it("refuses a cross-origin request before touching the database", async () => {
  expect((await POST(request(valid, "https://platform.example"))).status).toBe(403);
  expect(privileged.rpc).not.toHaveBeenCalled();
});

it.each([
  ["short token", { token: "bad", password: examplePassword }],
  ["token with invalid characters", { token: "A".repeat(42) + "=", password: examplePassword }],
  ["missing token", { password: examplePassword }],
  ["short password", { token: exampleToken, password: "x".repeat(11) }],
  ["long password", { token: exampleToken, password: "x".repeat(129) }],
])("rejects a malformed request (%s) before the claim", async (_label, body) => {
  await expectRejected(await POST(request(body)), 400);
  expect(privileged.rpc).not.toHaveBeenCalled();
});

it("accepts the password length boundaries", async () => {
  expect((await handler(request({ token: exampleToken, password: "x".repeat(12) }))).status).toBe(201);
  expect((await handler(request({ token: exampleToken, password: "x".repeat(128) }))).status).toBe(201);
});

it("rejects oversized and non-object bodies", async () => {
  expect((await POST(request({ ...valid, padding: "x".repeat(5000) }))).status).toBe(413);
  expect((await POST(request([valid]))).status).toBe(400);
  expect(privileged.rpc).not.toHaveBeenCalled();
});

it("does not create an account when the claim returns nothing (expired, consumed, revoked, rate-limited)", async () => {
  privileged.rpc.mockResolvedValue({ data: null, error: null });
  for (let attempt = 0; attempt < 2; attempt++) await expectRejected(await POST(request(valid)), 400);
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
  expect(rpcNames().every(name => name === "platform_claim_owner_invitation")).toBe(true);
});

it("does not create an account for a malformed claim", async () => {
  privileged.rpc.mockResolvedValue({ data: { invitation_id: "not-a-uuid", ...exampleAdmin }, error: null });
  await expectRejected(await POST(request(valid)), 400);
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
});

it("fails closed with the generic message when the claim errors or the service client is unavailable", async () => {
  privileged.rpc.mockResolvedValueOnce({ data: null, error: { message: "private database detail" } });
  await expectRejected(await POST(request(valid)), 503);
  vi.mocked(createSupabaseAdmin).mockImplementationOnce(() => { throw new Error("private configuration detail"); });
  await expectRejected(await POST(request(valid)), 503);
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
});

const authError = (error: Record<string, unknown>) => privileged.auth.admin.createUser.mockResolvedValue({ data: { user: null }, error: { message: "private provider detail", ...error } });
function releaseReturns(release: { data: unknown; error: unknown } | Error) {
  privileged.rpc.mockImplementation(async (name: string) => {
    if (name === "platform_claim_owner_invitation") return { data: { invitation_id: invitationId, ...exampleAdmin }, error: null };
    if (name === "platform_release_owner_invitation" && release instanceof Error) throw release;
    return name === "platform_release_owner_invitation" ? release : { data: true, error: null };
  });
}

it.each([
  ["throws", () => privileged.auth.admin.createUser.mockRejectedValue(new Error("private provider detail"))],
  ["returns an error without a status", () => authError({})],
  ["returns status 0", () => authError({ status: 0, code: "weak_password" })],
  ["returns a 5xx", () => authError({ status: 500, code: "weak_password" })],
  ["returns a string status", () => authError({ status: "422", code: "weak_password" })],
  ["returns no user and no error", () => privileged.auth.admin.createUser.mockResolvedValue({ data: { user: null }, error: null })],
])("holds the claim for review when account creation %s (uncertain outcome)", async (_label, arrange) => {
  arrange();
  await expectRejected(await POST(request(valid)), 409);
  expect(rpcNames()).toEqual(["platform_claim_owner_invitation"]);
});

it("releases the claim and asks for a stronger password when Auth definitely rejected a weak one", async () => {
  authError({ status: 422, code: "weak_password" });
  const response = await POST(request(valid));
  expect(response.status).toBe(400);
  const text = await response.text();
  expect(JSON.parse(text)).toEqual({ error: "Choose a stronger password and try again." });
  for (const secret of [exampleToken, examplePassword, "private"]) expect(text).not.toContain(secret);
  const [claim, release] = privileged.rpc.mock.calls;
  expect(release).toEqual(["platform_release_owner_invitation", { p_invitation_id: invitationId, p_claim_id: claim[1].p_claim_id }]);
  expect(rpcNames()).not.toContain("platform_complete_owner_invitation");
});

it.each([400, 409, 422, 499])("releases the claim with a generic rejection for other definite Auth errors (status %i)", async status => {
  authError({ status, code: "email_exists" });
  await expectRejected(await POST(request(valid)), 409);
  expect(rpcNames()).toEqual(["platform_claim_owner_invitation", "platform_release_owner_invitation"]);
});

it.each([
  ["returns false", { data: false, error: null }],
  ["errors", { data: true, error: { message: "private database detail" } }],
  ["throws", new Error("private network detail")],
])("does not suggest retrying with a stronger password when the release %s", async (_label, release) => {
  authError({ status: 422, code: "weak_password" });
  releaseReturns(release);
  await expectRejected(await POST(request(valid)), 409);
  expect(rpcNames()).toEqual(["platform_claim_owner_invitation", "platform_release_owner_invitation"]);
});

it.each([
  ["errors", { data: null, error: { message: "private database detail" } }],
  ["is not confirmed", { data: false, error: null }],
  ["throws", new Error("private network detail")],
])("fails closed when completion %s, telling the admin their account may exist", async (_label, completion) => {
  privileged.rpc.mockImplementation(async (name: string) => {
    if (name === "platform_claim_owner_invitation") return { data: { invitation_id: invitationId, ...exampleAdmin }, error: null };
    if (completion instanceof Error) throw completion;
    return completion;
  });
  await expectRejected(await POST(request(valid)), 503, mayBeSetUp);
  expect(privileged.auth.admin.createUser).toHaveBeenCalledTimes(1);
  expect(rpcNames()).toEqual(["platform_claim_owner_invitation", "platform_complete_owner_invitation"]);
});
