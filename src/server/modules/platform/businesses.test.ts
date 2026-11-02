import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createBusiness, listBusinesses } from "./businesses";
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(() => db) }));
beforeEach(() => {
  vi.stubEnv("PLATFORM_CONSOLE_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  db.rpc.mockImplementation((name: string) => queryResult(name === "platform_is_administrator" ? true : { id: "new-business", status: "provisioning" }));
  db.from.mockReturnValue(queryResult([]));
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
