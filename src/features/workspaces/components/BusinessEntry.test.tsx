import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { businessWorkspace, otherBusinessId, workspaceChoices, workspaceProfile } from "@tests/mocks/workspaces";
import { setDisplayedBusiness } from "../fetch";
import BusinessEntry from "./BusinessEntry";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  setDisplayedBusiness(null);
  db.auth.getUser.mockResolvedValue({ data: { user: { id: workspaceProfile.id } }, error: null });
  db.rpc.mockImplementation(name => queryResult(name === "my_workspaces" ? workspaceChoices : businessWorkspace));
});
it("opens only an active authorized business and revalidates selection", async () => {
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByRole("heading", { name: "Test business" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Open business" }));
  expect(db.rpc).toHaveBeenCalledWith("current_workspace");
  expect(router.replace).toHaveBeenCalledWith("/branch/home");
});
it("does not open an unrelated or suspended business", async () => {
  db.rpc.mockReturnValue(queryResult([{ ...workspaceChoices[0], business_status: "suspended" }]));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open business" })).not.toBeInTheDocument();
  expect(router.replace).not.toHaveBeenCalled();
});
it("does not reveal or open another business when its link is entered", async () => {
  render(<BusinessEntry slug="another-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(screen.queryByText("Test business")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open business" })).not.toBeInTheDocument();
  expect(router.replace).not.toHaveBeenCalled();
});
it("does not open a business before its isolation setup is complete", async () => {
  db.rpc.mockReturnValue(queryResult([{ ...workspaceChoices[0], isolation_ready: false }]));
  render(<BusinessEntry slug="test-business" />);
  expect(await screen.findByText(/unavailable for your account/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Open business" })).not.toBeInTheDocument();
});
it("keeps the entry page open when membership is revoked during selection", async () => {
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult(workspaceChoices) : queryResult(null, { message: "Workspace access is unavailable" }));
  render(<BusinessEntry slug="test-business" />);
  await userEvent.click(await screen.findByRole("button", { name: "Open business" }));
  expect(await screen.findByText("Workspace access is unavailable")).toBeVisible();
  expect(document.cookie).not.toContain("ahaa_business=");
  expect(router.replace).not.toHaveBeenCalled();
});
it("rejects a workspace response for a different business", async () => {
  db.rpc.mockImplementation(name => name === "my_workspaces" ? queryResult(workspaceChoices) : queryResult({ ...businessWorkspace, business: { ...businessWorkspace.business, id: otherBusinessId } }));
  render(<BusinessEntry slug="test-business" />);
  await userEvent.click(await screen.findByRole("button", { name: "Open business" }));
  expect(await screen.findByText("Workspace selection could not be verified.")).toBeVisible();
  expect(document.cookie).not.toContain("ahaa_business=");
  expect(router.replace).not.toHaveBeenCalled();
});
