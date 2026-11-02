import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceChooser from "./WorkspaceChooser";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { businessWorkspace, workspaceChoices, workspaceProfile } from "@tests/mocks/workspaces";
import { setDisplayedBusiness } from "../fetch";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  setDisplayedBusiness(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockImplementation(name => queryResult(name === "my_workspaces" ? workspaceChoices : businessWorkspace));
});
it.each([390, 820, 1280])("selects a verified membership and opens its role-specific home at %spx", async width => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  render(<WorkspaceChooser />);
  await userEvent.click(await screen.findByRole("button", { name: "Open workspace" }));
  expect(router.replace).toHaveBeenCalledWith("/branch/home");
  expect(db.rpc).toHaveBeenCalledWith("current_workspace");
});
it("does not offer access for a suspended or unprovisioned business", async () => {
  db.rpc.mockReturnValue(queryResult([{ ...workspaceChoices[0], business_status: "suspended" }]));
  render(<WorkspaceChooser />);
  expect(await screen.findByRole("button", { name: "Open workspace" })).toBeDisabled();
  expect(router.replace).not.toHaveBeenCalled();
});
it("retains the chooser and clears selection if access was revoked before opening", async () => {
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult(workspaceChoices) : queryResult(null, { message: "Workspace access is unavailable" }));
  render(<WorkspaceChooser />);
  await userEvent.click(await screen.findByRole("button", { name: "Open workspace" }));
  expect(await screen.findByText("Workspace access is unavailable")).toBeVisible();
  expect(document.cookie).not.toContain("ahaa_business=");
  expect(router.replace).not.toHaveBeenCalled();
});
