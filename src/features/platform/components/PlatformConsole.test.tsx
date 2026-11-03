import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { platformBusinesses } from "@tests/mocks/platform";
import { assignBusinessOwner, createBusinessOwner, fetchBusinesses, registerBusiness } from "../data";
import PlatformConsole from "./PlatformConsole";
vi.mock("../data", () => ({ fetchBusinesses: vi.fn(), registerBusiness: vi.fn(), assignBusinessOwner: vi.fn(), createBusinessOwner: vi.fn() }));
vi.mock("@/components/shared/SignOutButton", () => ({ SignOutButton: () => <button>Sign out</button> }));
beforeEach(() => {
  vi.mocked(fetchBusinesses).mockResolvedValue(platformBusinesses);
  vi.mocked(registerBusiness).mockResolvedValue();
  vi.mocked(assignBusinessOwner).mockResolvedValue();
  vi.mocked(createBusinessOwner).mockResolvedValue();
});
it("offers new-account setup only when separately enabled", async () => {
  render(<PlatformConsole registrationEnabled ownerAssignmentEnabled newOwnerEnabled />);
  fireEvent.click(await screen.findByRole("button", { name: "Assign first admin" }));
  fireEvent.click(screen.getByRole("button", { name: "New account" }));
  fireEvent.change(screen.getByLabelText("Admin name"), { target: { value: "Customer Admin" } });
  fireEvent.change(screen.getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "temporary-pass-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Assign admin" }));
  await waitFor(() => expect(createBusinessOwner).toHaveBeenCalledWith("b", "Customer Admin", "owner@example.invalid", "temporary-pass-123"));
  expect(await screen.findByText(/Admin assigned. The business remains in setup/)).toBeInTheDocument();
});
it("assigns an existing admin to a business still in setup", async () => {
  render(<PlatformConsole registrationEnabled ownerAssignmentEnabled />);
  fireEvent.click(await screen.findByRole("button", { name: "Assign first admin" }));
  fireEvent.change(screen.getByLabelText("Admin email"), { target: { value: "owner@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Assign admin" }));
  await waitFor(() => expect(assignBusinessOwner).toHaveBeenCalledWith("b", "owner@example.invalid"));
  expect(await screen.findByText(/Admin assigned. The business remains in setup/)).toBeInTheDocument();
});
it("shows business setup separately from customer operations", async () => {
  render(<PlatformConsole />);
  expect(await screen.findByText("Ahaa")).toBeInTheDocument();
  expect(screen.getByText("Example Business")).toBeInTheDocument();
  expect(screen.getByText("Existing access")).toBeInTheDocument();
  expect(screen.getByText("Setup pending")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /invoice/i })).not.toBeInTheDocument();
});
it("registers a business in a dialog and explains the pending activation", async () => {
  render(<PlatformConsole registrationEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "New Customer" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "new-customer" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  await waitFor(() => expect(registerBusiness).toHaveBeenCalledWith("New Customer", "new-customer"));
  expect(await screen.findByText(/Business registered. Owner setup/)).toBeInTheDocument();
});
it("keeps entered details available when registration fails", async () => {
  vi.mocked(registerBusiness).mockRejectedValue(new Error("That business address is already in use."));
  render(<PlatformConsole registrationEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Ahaa" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "ahaa" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  expect(await screen.findByText("That business address is already in use.")).toBeInTheDocument();
  expect(screen.getByLabelText("Business name")).toHaveValue("Ahaa");
});
it("shows the starting dashboard with registration unavailable by default", async () => {
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Superadmin dashboard" })).toBeInTheDocument();
  expect(await screen.findByRole("region", { name: "Business overview" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add business" })).not.toBeInTheDocument();
});
it("shows platform navigation while admin assignment remains independently disabled", async () => {
  render(<PlatformConsole registrationEnabled />);
  expect(await screen.findByRole("navigation", { name: "Platform navigation" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Businesses" })).toHaveAttribute("href", "#businesses");
  expect(screen.getByRole("button", { name: "Add business" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Assign first admin" })).not.toBeInTheDocument();
});
