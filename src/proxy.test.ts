import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { db, queryResult } from "@tests/mocks/supabase";
import { adminWorkspace, businessId, businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";
import { proxy } from "./proxy";
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => db) }));
vi.mock("@/lib/supabase/env", () => ({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_KEY: "test-public-key", SUPABASE_CONFIGURED: true }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockReturnValue(queryResult(businessWorkspace));
});
it("uses the selected membership role, never an admin role from another business", async () => {
  db.from.mockReturnValue(queryResult(adminWorkspace.profile));
  const response = await proxy(new NextRequest("https://app.test/admin/users", { headers: { cookie: `ahaa_business=${businessId}` } }));
  expect(response.headers.get("location")).toBe("https://app.test/branch/home");
  expect(createServerClient).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ global: { headers: { "x-business-id": businessId } } }));
  expect(db.from).not.toHaveBeenCalled();
});
it("retains the login and requests workspace selection when context is missing", async () => {
  db.rpc.mockReturnValue(queryResult(null, { message: "Choose a workspace" }));
  const response = await proxy(new NextRequest("https://app.test/admin/users"));
  expect(response.headers.get("location")).toBe("https://app.test/workspaces");
  expect(db.auth.signOut).not.toHaveBeenCalled();
});
it("allows an authenticated chooser to recover from an invalid cookie", async () => {
  const response = await proxy(new NextRequest("https://app.test/workspaces", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(response.headers.get("location")).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
});
it("requires sign-in for the chooser", async () => {
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await proxy(new NextRequest("https://app.test/workspaces"));
  expect(response.headers.get("location")).toContain("/login?next=");
});
it("preserves the existing route authorization while business mode is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  db.from.mockReturnValue(queryResult(adminWorkspace.profile));
  const response = await proxy(new NextRequest("https://app.test/admin/users"));
  expect(response.headers.get("location")).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
});
it("keeps the platform console unavailable by default", async () => {
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "false");
  expect((await proxy(new NextRequest("https://app.test/superadmin"))).status).toBe(404);
});
it("authorizes platform access independently of customer selection and role", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.rpc.mockReturnValue(queryResult(true));
  const response = await proxy(new NextRequest("https://app.test/superadmin", { headers: { cookie: "ahaa_business=invalid" } }));
  expect(response.status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("platform_is_administrator");
  expect(db.from).not.toHaveBeenCalled();
});
it("does not treat a customer admin as a platform admin", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.rpc.mockReturnValue(queryResult(false));
  expect((await proxy(new NextRequest("https://app.test/superadmin"))).status).toBe(403);
});
it("keeps business pages and APIs unavailable on the platform deployment", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  for (const path of ["/admin/orders", "/branch/home", "/employee/inventory", "/workspaces", "/api/admin/branch-users", "/api/receipts", "/api/invoices/order/id/pdf", "/admin/orders/id.pdf"]) {
    expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
  }
  expect(db.auth.getUser).not.toHaveBeenCalled();
});
it("keeps platform pages, login and APIs unavailable on the business deployment even if the console flag is set", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  for (const path of ["/superadmin", "/login?next=/superadmin", "/api/platform/businesses"]) expect((await proxy(new NextRequest(`https://app.test${path}`))).status).toBe(404);
});
it("uses the platform sign-in destination for its root and plain login", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  expect((await proxy(new NextRequest("https://app.test/"))).headers.get("location")).toBe("https://app.test/superadmin");
  expect((await proxy(new NextRequest("https://app.test/login"))).headers.get("location")).toBe("https://app.test/login?next=/superadmin");
});
