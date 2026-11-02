import { expect, it } from "vitest";
import { parseWorkspace, selectedBusiness } from "./context";
import { businessId, businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";

it("treats selection as an untrusted preference and rejects malformed or duplicate cookies", () => {
  expect(selectedBusiness(`other=value; ahaa_business=${businessId}`)).toBe(businessId);
  expect(selectedBusiness("other=value")).toBeNull();
  for (const cookie of ["ahaa_business=bad", "ahaa_business=%ZZ", `ahaa_business=${businessId}; ahaa_business=${businessId}`]) {
    expect(() => selectedBusiness(cookie)).toThrow("Invalid workspace selection");
  }
});

it("requires an active, correctly assigned profile belonging to the authenticated identity", () => {
  expect(parseWorkspace(businessWorkspace, workspaceProfile.id)).toEqual(businessWorkspace);
  for (const value of [null, {}, { ...businessWorkspace, profile: { ...workspaceProfile, status: "disabled" } },
    { ...businessWorkspace, profile: { ...workspaceProfile, location_id: null } },
    { ...businessWorkspace, business: { ...businessWorkspace.business, id: "invalid" } }]) {
    expect(() => parseWorkspace(value, workspaceProfile.id)).toThrow("Workspace access");
  }
  expect(() => parseWorkspace(businessWorkspace, "different-user")).toThrow("Workspace access");
});
