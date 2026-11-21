import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { exampleInvitationToken as token } from "@tests/mocks/platform";
import AcceptInvitationPage from "./page";

afterEach(() => window.history.replaceState(null, "", "/"));

it("removes the invitation secret from the address and submits a user-chosen password", async () => {
  window.history.replaceState(null, "", `/accept-invite#token=${token}`);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<AcceptInvitationPage />);
  await waitFor(() => expect(window.location.hash).toBe(""));
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Strong-password-123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Strong-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/accept", expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify({ token, password: "Strong-password-123" }) })));
  expect(await screen.findByText(/platform administrator must activate/)).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

it("does not submit an invalid link or mismatched passwords", async () => {
  window.history.replaceState(null, "", "/accept-invite");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { unmount } = render(<AcceptInvitationPage />);
  expect(await screen.findByText(/invalid or expired/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Set password" })).toBeDisabled();
  unmount();
  window.history.replaceState(null, "", `/accept-invite#token=${token}`);
  render(<AcceptInvitationPage />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Strong-password-123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Different-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText(/match/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("retains the secret in memory across StrictMode effect replay while removing it from the URL", async () => {
  window.history.replaceState(null, "", `/accept-invite#token=${token}`);
  render(<StrictMode><AcceptInvitationPage /></StrictMode>);
  await waitFor(() => expect(window.location.hash).toBe(""));
  expect(screen.getByLabelText("New password")).toBeEnabled();
  expect(screen.queryByText(/invalid or expired/)).not.toBeInTheDocument();
});

it("keeps the account setup form available when the invitation cannot be accepted", async () => {
  window.history.replaceState(null, "", `/accept-invite#token=${token}`);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "This invitation could not be completed." }) }));
  render(<AcceptInvitationPage />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Strong-password-123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Strong-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText("This invitation could not be completed.")).toBeInTheDocument();
  expect(screen.getByLabelText("New password")).toBeEnabled();
});
