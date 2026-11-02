import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { businessId, businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { receiptAccess, receiptScope } from "./access";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServer: vi.fn(async () => db) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdmin: vi.fn(() => db) }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockReturnValue(queryResult(businessWorkspace));
});

it("derives privileged receipt scope from the authorized membership", async () => {
  const access = await receiptAccess(new Request("https://app.test/api/receipts"));
  expect(access.businessId).toBe(businessId);
  expect(access.locationId).toBe(workspaceProfile.location_id);
  expect(db.from).not.toHaveBeenCalled();
  expect(createSupabaseAdmin).toHaveBeenCalledTimes(1);
});
it("denies unresolved workspaces and employee memberships before creating a privileged client", async () => {
  db.rpc.mockReturnValue(queryResult(null, { message: "Workspace access is unavailable" }));
  await expect(receiptAccess(new Request("https://app.test/api/receipts"))).rejects.toThrow("Workspace access");
  db.rpc.mockReturnValue(queryResult({ ...businessWorkspace, profile: { ...workspaceProfile, role: "BRANCH_EMPLOYEE" } }));
  await expect(receiptAccess(new Request("https://app.test/api/receipts"))).rejects.toThrow("Only active");
  expect(createSupabaseAdmin).not.toHaveBeenCalled();
});
it("requires business scope and chains it before branch scope even with immutable builders", () => {
  const final = {};
  const scoped = { eq: vi.fn(() => final), is: vi.fn(() => final) };
  const query = { eq: vi.fn(() => scoped), is: vi.fn() };
  expect(() => receiptScope(query, null)).toThrow("Workspace access");
  expect(query.eq).not.toHaveBeenCalled();
  expect(receiptScope(query, workspaceProfile.location_id, businessId)).toBe(final);
  expect(query.eq).toHaveBeenCalledWith("business_id", businessId);
  expect(scoped.eq).toHaveBeenCalledWith("location_id", workspaceProfile.location_id);
  expect(receiptScope(query, null, businessId)).toBe(final);
  expect(scoped.is).toHaveBeenCalledWith("location_id", null);
});
