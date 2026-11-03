import { expect, it } from "vitest";
import { businessEntrySlug, parseWorkspace, selectedBusiness } from "./context";
import { businessId, businessWorkspace, workspaceProfile } from "@tests/mocks/workspaces";

it("treats selection as an untrusted preference and rejects malformed or duplicate cookies", () => {
  expect(selectedBusiness(`other=value; ahaa_business=${businessId}`)).toBe(businessId);
  expect(selectedBusiness("other=value")).toBeNull();
  for (const cookie of ["ahaa_business=bad", "ahaa_business=%ZZ", `ahaa_business=${businessId}; ahaa_business=${businessId}`]) {
    expect(() => selectedBusiness(cookie)).toThrow("Invalid workspace selection");
  }
});
it("accepts only local, canonical business entry paths", () => {
  expect(businessEntrySlug("/b/example-business")).toBe("example-business");
  for (const path of [null,"//other.test/b/example","/b/a","/b/Example","/b/example/../admin","/b/example?next=//other.test","/b/%2fexample",`/b/${"a".repeat(61)}`]) expect(businessEntrySlug(path)).toBeNull();
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
