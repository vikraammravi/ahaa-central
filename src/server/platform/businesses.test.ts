import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { assignInitialOwner, createBusiness, createInitialOwner, listBusinesses } from "./businesses";
import { businessId } from "@tests/mocks/workspaces";
import { platformBusinesses } from "@tests/mocks/platform";
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
const privileged = vi.hoisted(() => ({ rpc: vi.fn(), auth: { admin: { createUser: vi.fn() } } }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn(() => privileged) }));
beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
  vi.stubEnv("PLATFORM_NEW_OWNER_CREATION_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : { id: "new-business", status: "provisioning" }));
  db.from.mockReturnValue(queryResult([]));
  privileged.auth.admin.createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
  privileged.rpc.mockResolvedValue({ data: true, error: null });
});
it("creates a first admin only after the platform and isolation preflight checks", async () => {
  db.rpc.mockReturnValue(queryResult(true));
  const response = await createInitialOwner(request({ name: " Customer Admin ", email: "Owner@example.invalid", password: "temporary-pass-123" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(201);
  expect(db.rpc).toHaveBeenCalledWith("platform_can_create_owner", { p_business_id: businessId });
  expect(privileged.rpc).toHaveBeenCalledWith("platform_assign_new_owner", { p_business_id: businessId, p_actor_id: "platform-user", p_user_id: "new-user", p_name: "Customer Admin" });
  expect(JSON.stringify(await response.json())).not.toContain("temporary-pass-123");
});
it("never creates an account when isolation is not ready", async () => {
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator"));
  const response = await createInitialOwner(request({ name: "Owner", email: "owner@example.invalid", password: "temporary-pass-123" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(409);
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
});
it("rejects untrusted requests and disabled account creation before touching Auth", async () => {
  const context = { params: Promise.resolve({ id: businessId }) };
  const input = { name: "Owner", email: "owner@example.invalid", password: "temporary-pass-123" };
  expect((await createInitialOwner(request(input, "https://other.test"), context)).status).toBe(403);
  vi.stubEnv("PLATFORM_NEW_OWNER_CREATION_ENABLED", "false");
  expect((await createInitialOwner(request(input), context)).status).toBe(409);
  expect(privileged.auth.admin.createUser).not.toHaveBeenCalled();
});
it("reports uncertain creation outcomes without exposing secrets", async () => {
  db.rpc.mockReturnValue(queryResult(true));
  privileged.auth.admin.createUser.mockRejectedValue(new Error("private network detail"));
  const response = await createInitialOwner(request({ name: "Owner", email: "owner@example.invalid", password: "temporary-pass-123" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(503);
  const result = JSON.stringify(await response.json());
  expect(result).toContain("Review the account before retrying");
  expect(result).not.toContain("temporary-pass-123");
  expect(result).not.toContain("private network detail");
  expect(privileged.rpc).not.toHaveBeenCalled();
});
it("preserves an account for review when assignment cannot be confirmed", async () => {
  db.rpc.mockReturnValue(queryResult(true));
  privileged.rpc.mockRejectedValue(new Error("network error"));
  const response = await createInitialOwner(request({ name: "Owner", email: "owner@example.invalid", password: "temporary-pass-123" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(503);
  expect((await response.json()).error).toMatch(/preserved/);
});
it("can enable the dashboard while registration remains disabled", async () => {
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "false");
  expect((await listBusinesses()).status).toBe(200);
  expect((await createBusiness(request({ name: "Test", slug: "test" }))).status).toBe(409);
  expect(db.rpc.mock.calls.some(([name]) => name === "platform_create_business")).toBe(false);
});
function request(value: unknown, origin = "https://app.test") {
  return new Request("https://app.test/api/platform/businesses", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(value) });
}
it("is unavailable unless explicitly enabled", async () => {
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "false");
  expect((await listBusinesses()).status).toBe(404);
  expect(createSupabaseServer).not.toHaveBeenCalled();
});
it("requires verified sign-in and explicit platform permission", async () => {
  db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await listBusinesses()).status).toBe(401);
  db.rpc.mockReturnValue(queryResult(false));
  expect((await listBusinesses()).status).toBe(403);
  expect(db.from).not.toHaveBeenCalled();
});
it("reads only bounded business metadata independent of a selected customer", async () => {
  const response = await listBusinesses();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(createSupabaseServer).toHaveBeenCalledWith({ workspace: false });
  expect(db.from.mock.calls).toEqual([["businesses"]]);
});
it("denies cross-origin creation and invalid details before the provisioning RPC", async () => {
  expect((await createBusiness(request({ name: "Test", slug: "test" }, "https://other.test"))).status).toBe(403);
  expect((await createBusiness(request({ name: "Test", slug: "../admin" }))).status).toBe(400);
  expect(db.rpc.mock.calls.some(([name]) => name === "platform_create_business")).toBe(false);
});
it("registers through the authenticated RPC without accepting activation or role overrides", async () => {
  const response = await createBusiness(request({ name: " Test ", slug: "test", status: "active", isolation_ready: true }));
  expect(response.status).toBe(201);
  expect(db.rpc).toHaveBeenCalledWith("platform_create_business", { p_name: "Test", p_slug: "test" });
  expect(db.from).not.toHaveBeenCalled();
});
it("reports a duplicate address without exposing internal database details", async () => {
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(true) : queryResult(null, { message: "private constraint detail", code: "23505" } as { message: string }));
  const response = await createBusiness(request({ name: "Test", slug: "test" }));
  expect(response.status).toBe(409);
  expect(JSON.stringify(await response.json())).not.toContain("private constraint");
});
it("reports owner assignment without exposing membership details", async () => {
  db.from.mockReturnValue(queryResult([{ ...platformBusinesses[1], business_memberships: [{ role: "CENTRAL_ADMIN" }] }]));
  const response = await listBusinesses();
  const result = await response.json();
  expect(result.businesses[0].owner_assigned).toBe(true);
  expect(result.businesses[0]).not.toHaveProperty("business_memberships");
});
it("assigns an existing first admin only through the authorized platform RPC", async () => {
  const response = await assignInitialOwner(request({ email: " Owner@Example.invalid ", role: "BRANCH_MANAGER" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("platform_assign_initial_owner", { p_business_id: businessId, p_email: "owner@example.invalid" });
  expect(db.from).not.toHaveBeenCalled();
});
it("does not assign an owner when access, setup or input is invalid", async () => {
  const context = { params: Promise.resolve({ id: businessId }) };
  expect((await assignInitialOwner(request({ email: "owner@example.invalid" }, "https://other.test"), context)).status).toBe(403);
  expect((await assignInitialOwner(request({ email: "bad" }), context)).status).toBe(400);
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "false");
  expect((await assignInitialOwner(request({ email: "owner@example.invalid" }), context)).status).toBe(409);
  expect(db.rpc.mock.calls.some(([name]) => name === "platform_assign_initial_owner")).toBe(false);
});
it("rejects an oversized body even when content length is absent", async () => {
  const oversized = new Request("https://app.test/api/platform/businesses", { method: "POST", headers: { origin: "https://app.test" }, body: "x".repeat(4097) });
  expect((await createBusiness(oversized)).status).toBe(413);
  expect(db.rpc.mock.calls.some(([name]) => name === "platform_create_business")).toBe(false);
});
it("rejects a customer admin without platform access before assigning an owner", async () => {
  db.rpc.mockReturnValue(queryResult(false));
  const response = await assignInitialOwner(request({ email: "owner@example.invalid" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(403);
  expect(db.rpc.mock.calls.some(([name]) => name === "platform_assign_initial_owner")).toBe(false);
});
it.each([
  ["P0002", 404, "An active account with this email was not found."],
  ["P0003", 409, "More than one active account matches this email. Contact support."],
  ["23505", 409, "An initial admin has already been assigned."],
  ["55000", 409, "This business is not ready for admin assignment."],
])("safely reports initial-admin assignment error %s", async (code, status, message) => {
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(true) : queryResult(null, { message: "private database detail", code } as { message: string }));
  const response = await assignInitialOwner(request({ email: "owner@example.invalid" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: message });
});
