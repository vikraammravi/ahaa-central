import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { platformBusinesses } from "@tests/mocks/platform";
import { fetchBusinesses, registerBusiness } from "../data";
import PlatformConsole from "./PlatformConsole";
vi.mock("../data", () => ({ fetchBusinesses: vi.fn(), registerBusiness: vi.fn() }));
vi.mock("@/components/shared/SignOutButton", () => ({ SignOutButton: () => <button>Sign out</button> }));
beforeEach(() => {
  vi.mocked(fetchBusinesses).mockResolvedValue(platformBusinesses);
  vi.mocked(registerBusiness).mockResolvedValue();
});
it("shows business setup separately from customer operations", async () => {
  render(<PlatformConsole />);
  expect(await screen.findByText("Ahaa")).toBeInTheDocument();
  expect(screen.getByText("Example Business")).toBeInTheDocument();
  expect(screen.getAllByText("Setup pending")).toHaveLength(2);
  expect(screen.queryByRole("link", { name: /invoice/i })).not.toBeInTheDocument();
});
it("registers a business in a dialog and explains the pending activation", async () => {
  render(<PlatformConsole />);
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "New Customer" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "new-customer" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  await waitFor(() => expect(registerBusiness).toHaveBeenCalledWith("New Customer", "new-customer"));
  expect(await screen.findByText(/Business registered. Owner setup/)).toBeInTheDocument();
});
it("keeps entered details available when registration fails", async () => {
  vi.mocked(registerBusiness).mockRejectedValue(new Error("That business address is already in use."));
  render(<PlatformConsole />);
  fireEvent.click(screen.getByRole("button", { name: "Add business" }));
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Ahaa" } });
  fireEvent.change(screen.getByLabelText("Business address"), { target: { value: "ahaa" } });
  fireEvent.click(screen.getByRole("button", { name: "Register business" }));
  expect(await screen.findByText("That business address is already in use.")).toBeInTheDocument();
  expect(screen.getByLabelText("Business name")).toHaveValue("Ahaa");
});
