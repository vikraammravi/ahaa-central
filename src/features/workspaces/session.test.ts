import { beforeEach, expect, it, vi } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";
import { loadSessionProfile } from "./session";

type Database = Parameters<typeof loadSessionProfile>[0];
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true"));
it("uses the membership projection rather than the global profile role", async () => {
  db.rpc.mockReturnValue(queryResult(businessWorkspace));
  const result = await loadSessionProfile(db as unknown as Database, workspaceProfile.id);
  expect(result.profile?.role).toBe("BRANCH_MANAGER");
  expect(result.business?.id).toBe(businessWorkspace.business.id);
  expect(db.rpc).toHaveBeenCalledWith("current_workspace");
  expect(db.from).not.toHaveBeenCalled();
});
it("never falls back to global privileges when workspace authorization fails", async () => {
  db.rpc.mockReturnValue(queryResult(null, { message: "Workspace access is unavailable" }));
  const result = await loadSessionProfile(db as unknown as Database, workspaceProfile.id);
  expect(result.profile).toBeNull();
  expect(result.error?.message).toContain("Workspace access");
  expect(db.from).not.toHaveBeenCalled();
});
it("retains the current single-business flow while the feature is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  db.from.mockReturnValue(queryResult(workspaceProfile));
  const result = await loadSessionProfile(db as unknown as Database, workspaceProfile.id);
  expect(result.profile).toEqual(workspaceProfile);
  expect(result.business).toBeNull();
  expect(db.rpc).not.toHaveBeenCalled();
});
