import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { createSupabaseServer } from "@/lib/supabase/server";
import * as businessModule from "./businesses";
import { activateBusiness, assignInitialOwner, createBusiness, listBusinesses } from "./businesses";
import { existsSync } from "node:fs";
import { exampleSummaryRow, invitationBusinessId } from "@tests/mocks/platform-invitations";
import { businessId } from "@tests/mocks/workspaces";
import { platformBusinesses } from "@tests/mocks/platform";
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
beforeEach(() => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", "true");
  vi.stubEnv("PLATFORM_OWNER_ASSIGNMENT_ENABLED", "true");
  vi.stubEnv("PLATFORM_BUSINESS_ACTIVATION_ENABLED", "true");
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "false");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : { id: "new-business", status: "provisioning" }));
  db.from.mockReturnValue(queryResult([]));
});
it("activates only through the authorized business activation operation", async () => {
  const response = await activateBusiness(request({}), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(db.rpc).toHaveBeenCalledWith("activate_platform_business", { p_business_id: businessId });
  expect(db.from).not.toHaveBeenCalled();
});
it("does not activate for untrusted origins, invalid IDs, disabled activation, or non-platform users", async () => {
  const context = { params: Promise.resolve({ id: businessId }) };
  expect((await activateBusiness(request({}, "https://other.test"), context)).status).toBe(403);
  expect((await activateBusiness(request({}), { params: Promise.resolve({ id: "../admin" }) })).status).toBe(400);
  vi.stubEnv("PLATFORM_BUSINESS_ACTIVATION_ENABLED", "false");
  expect((await activateBusiness(request({}), context)).status).toBe(409);
  vi.stubEnv("PLATFORM_BUSINESS_ACTIVATION_ENABLED", "true");
  db.rpc.mockReturnValue(queryResult(false));
  expect((await activateBusiness(request({}), context)).status).toBe(403);
  expect(db.rpc.mock.calls.some(([name]) => name === "activate_platform_business")).toBe(false);
});
it.each([["P0002", 404], ["55000", 409], ["42501", 403]])("returns a safe response when activation fails with %s", async (code, status) => {
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(true) : queryResult(null, { message: "private database detail", code } as { message: string }));
  const response = await activateBusiness(request({}), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(status);
  expect(JSON.stringify(await response.json())).not.toContain("private database detail");
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
it("keeps admin assignment disabled independently of business registration", async () => {
  vi.stubEnv("PLATFORM_OWNER_ASSIGNMENT_ENABLED", "false");
  const response = await assignInitialOwner(request({ email: "owner@example.invalid" }), { params: Promise.resolve({ id: businessId }) });
  expect(response.status).toBe(409);
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
const directoryRow = { id: invitationBusinessId, name: "Example Business", slug: "example-business", status: "provisioning", isolation_ready: false, created_at: "2026-11-02T00:00:00Z", business_memberships: [] };
const listRpcNames = () => db.rpc.mock.calls.map(([name]) => name);
it("does not read invitation summaries unless registration and invitations are both enabled", async () => {
  db.from.mockReturnValue(queryResult([directoryRow]));
  for (const [registration, invitations] of [["true", "false"], ["false", "true"]]) {
    vi.stubEnv("PLATFORM_BUSINESS_REGISTRATION_ENABLED", registration);
    vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", invitations);
    const result = await (await listBusinesses()).json();
    expect(result).toEqual({ businesses: [expect.objectContaining({ id: invitationBusinessId, owner_assigned: false, invitation: null })], invitationsUnavailable: false });
  }
  expect(listRpcNames()).not.toContain("platform_owner_invitation_summary");
});
it("attaches the latest invitation per business without any token material", async () => {
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
  const other = { ...directoryRow, id: businessId, slug: "other" };
  db.from.mockReturnValue(queryResult([directoryRow, other]));
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : [exampleSummaryRow]));
  const response = await listBusinesses();
  const text = await response.text();
  const result = JSON.parse(text);
  expect(db.rpc).toHaveBeenCalledWith("platform_owner_invitation_summary", { p_business_ids: [invitationBusinessId, businessId] });
  expect(result.invitationsUnavailable).toBe(false);
  const { name, email, state, created_at, expires_at, completed_at } = exampleSummaryRow;
  const visible = { name, email, state, created_at, expires_at, completed_at };
  expect(result.businesses[0].invitation).toEqual(visible);
  expect(result.businesses[1].invitation).toBeNull();
  expect(text).not.toContain("token");
  expect(text).not.toContain("never-returned");
});
it("ignores summary rows for businesses outside the listed page", async () => {
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
  db.from.mockReturnValue(queryResult([{ ...directoryRow, id: businessId }]));
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : [exampleSummaryRow]));
  const result = await (await listBusinesses()).json();
  expect(result.businesses).toEqual([expect.objectContaining({ id: businessId, invitation: null })]);
  expect(JSON.stringify(result)).not.toContain(exampleSummaryRow.email);
});
it("skips the summary for an empty directory", async () => {
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
  db.from.mockReturnValue(queryResult([]));
  expect(await (await listBusinesses()).json()).toEqual({ businesses: [], invitationsUnavailable: false });
  expect(listRpcNames()).not.toContain("platform_owner_invitation_summary");
});
it.each([
  ["returns an error", () => queryResult(null, { message: "private database detail" })],
  ["returns a non-list", () => queryResult({ unexpected: true })],
  ["throws", () => { throw new Error("private network detail"); }],
])("still loads the directory and flags invitations unavailable when the summary %s", async (_label, summary) => {
  vi.stubEnv("PLATFORM_OWNER_INVITATIONS_ENABLED", "true");
  db.from.mockReturnValue(queryResult([directoryRow]));
  db.rpc.mockImplementation((name: string) => name === "platform_is_administrator" ? queryResult(true) : summary());
  const response = await listBusinesses();
  expect(response.status).toBe(200);
  const text = await response.text();
  const result = JSON.parse(text);
  expect(result.invitationsUnavailable).toBe(true);
  expect(result.businesses).toEqual([expect.objectContaining({ id: invitationBusinessId, invitation: null })]);
  expect(text).not.toContain("private");
});
it("no longer offers temporary-password owner creation", () => {
  expect(businessModule).not.toHaveProperty("createInitialOwner");
  expect(existsSync("src/app/api/platform/businesses/[id]/owner/new/route.ts")).toBe(false);
});
