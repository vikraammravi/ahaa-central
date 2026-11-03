import { beforeEach, expect, it, vi } from "vitest";
import { db } from "@tests/mocks/supabase";
import { businessId, otherBusinessId, workspaceProfile } from "@tests/mocks/workspaces";
import { chooseWorkspace } from "./data";
import { saveBusinessSelection } from "./selection";
import { setDisplayedBusiness } from "./fetch";

vi.mock("./fetch", () => ({ setDisplayedBusiness: vi.fn() }));

beforeEach(() => {
  saveBusinessSelection(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
});

it("preserves a newer workspace selection when an older selection fails", async () => {
  db.rpc.mockImplementation(async () => {
    saveBusinessSelection(otherBusinessId);
    return { data: null, error: { message: "Workspace changed." } };
  });
  await expect(chooseWorkspace(businessId)).rejects.toThrow("Workspace changed.");
  expect(document.cookie).toContain(`ahaa_business=${otherBusinessId}`);
  expect(setDisplayedBusiness).not.toHaveBeenCalledWith(null);
});
