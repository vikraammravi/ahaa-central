import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryUsageHistory } from "./InventoryUsageHistory";
import { usageHistoryPage } from "@tests/mocks/inventory-usage";

vi.mock("@/features/inventory/usage-history", async importOriginal => ({
  ...(await importOriginal<typeof import("@/features/inventory/usage-history")>()),
  fetchUsageHistory: vi.fn(async () => usageHistoryPage),
}));

it("shows saved item usage and filters the history by item", async () => {
  const { fetchUsageHistory } = await import("@/features/inventory/usage-history");
  render(<InventoryUsageHistory/>);
  expect(await screen.findByText("Idli Batter")).toBeVisible();
  expect(screen.getByText("4")).toBeVisible();
  expect(screen.getByText("Branch employee")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search Item"), "Batter");
  await waitFor(() => expect(fetchUsageHistory).toHaveBeenCalledWith(expect.objectContaining({search:"Batter"}), expect.any(AbortSignal)));
});
