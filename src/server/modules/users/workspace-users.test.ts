import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { adminWorkspace, businessWorkspace, newBusinessUser, targetMemberId, workspaceProfile } from "@tests/mocks/workspaces";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createBusinessUser, removeBusinessUser, updateBusinessUser } from "./workspace-users";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(async () => db) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn() }));
const privileged = { rpc: vi.fn(), auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } } };
const context = { params: Promise.resolve({ id: targetMemberId }) };
function request(method: string, body?: unknown, origin = "https://app.test") {
  return new Request("https://app.test/api/admin/users/" + targetMemberId, { method, headers: { origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockImplementation(name => queryResult(name === "current_workspace" ? adminWorkspace : true));
  db.from.mockReturnValue(queryResult({ id: newBusinessUser.locationId }));
  vi.mocked(createSupabaseAdmin).mockReturnValue(privileged as unknown as ReturnType<typeof createSupabaseAdmin>);
  privileged.auth.admin.createUser.mockResolvedValue({ data: { user: { id: targetMemberId } }, error: null });
  privileged.rpc.mockResolvedValue({ data: true, error: null });
});
it("removes only a membership without creating a privileged client or deleting the login", async () => {
  expect((await removeBusinessUser(request("DELETE"), context)).status).toBe(200);
  expect(db.rpc).toHaveBeenCalledWith("remove_business_member", { p_user_id: targetMemberId });
  expect(createSupabaseAdmin).not.toHaveBeenCalled();
  expect(privileged.auth.admin.deleteUser).not.toHaveBeenCalled();
});
it("rejects foreign origins and a non-admin membership before mutations", async () => {
  expect((await removeBusinessUser(request("DELETE", undefined, "https://other.test"), context)).status).toBe(403);
  expect(db.rpc).not.toHaveBeenCalled();
  db.rpc.mockReturnValue(queryResult(businessWorkspace));
  expect((await removeBusinessUser(request("DELETE"), context)).status).toBe(403);
  expect(db.rpc).not.toHaveBeenCalledWith("remove_business_member", expect.anything());
});
it("forwards member edits to the database guard and preserves last-admin errors", async () => {
  db.rpc.mockImplementation(name => name === "current_workspace" ? queryResult(adminWorkspace) : queryResult(null, { message: "Keep at least one active business admin" }));
  const response = await updateBusinessUser(request("PATCH", { role: "BRANCH_MANAGER" }), context);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("at least one");
  expect(db.from).not.toHaveBeenCalled();
});
it("creates a branch account with verified business and actor context, without returning its password", async () => {
  const response = await createBusinessUser(request("POST", newBusinessUser));
  expect(response.status).toBe(201);
  expect(privileged.rpc).toHaveBeenCalledWith("assign_new_business_user", expect.objectContaining({ p_business_id: adminWorkspace.business.id, p_actor_id: workspaceProfile.id, p_user_id: targetMemberId }));
  expect(await response.text()).not.toContain(newBusinessUser.password);
});
it("does not delete a login after an uncertain remote assignment result", async () => {
  privileged.rpc.mockResolvedValue({ data: false, error: null });
  expect((await createBusinessUser(request("POST", newBusinessUser))).status).toBe(503);
  expect(privileged.auth.admin.deleteUser).not.toHaveBeenCalled();
});
