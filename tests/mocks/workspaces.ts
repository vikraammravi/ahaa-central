import { profile } from "./fixtures";
import type { Workspace } from "@/features/workspaces/context";

export const businessId = "11111111-1111-4111-8111-111111111111";
export const otherBusinessId = "22222222-2222-4222-8222-222222222222";
export const workspaceProfile = { ...profile, id: "33333333-3333-4333-8333-333333333333", location_id: "44444444-4444-4444-8444-444444444444" };
export const businessWorkspace: Workspace = {
  business: { id: businessId, name: "Test business", slug: "test-business", settings: {} },
  profile: workspaceProfile,
};
export const adminWorkspace: Workspace = { ...businessWorkspace, profile: { ...workspaceProfile, role: "CENTRAL_ADMIN", location_id: null } };
export const targetMemberId = "55555555-5555-4555-8555-555555555555";
export const newBusinessUser = { fullName: "Test Employee", email: "employee@example.invalid", password: "test-password-123", role: "BRANCH_EMPLOYEE", locationId: workspaceProfile.location_id! };
export const workspaceChoices = [{ business_id: businessId, name: "Test business", slug: "test-business", role: "BRANCH_MANAGER" as const, status: "active" as const, business_status: "active", isolation_ready: true }];
