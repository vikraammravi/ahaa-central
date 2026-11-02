import { profile } from "./fixtures";
import type { Workspace } from "@/features/workspaces/context";

export const businessId = "11111111-1111-4111-8111-111111111111";
export const otherBusinessId = "22222222-2222-4222-8222-222222222222";
export const workspaceProfile = { ...profile, id: "33333333-3333-4333-8333-333333333333", location_id: "44444444-4444-4444-8444-444444444444" };
export const businessWorkspace: Workspace = {
  business: { id: businessId, name: "Test business", slug: "test-business", settings: {} },
  profile: workspaceProfile,
};
