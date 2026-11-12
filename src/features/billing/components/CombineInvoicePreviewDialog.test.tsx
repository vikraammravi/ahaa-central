import { expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CombineInvoicePreviewDialog } from "./CombineInvoicePreviewDialog";
import { fetchCombinedInvoicePreview } from "../data";
import { order } from "@tests/mocks/fixtures";

vi.mock("../data", () => ({ fetchCombinedInvoicePreview: vi.fn() }));

it("requires another confirmation if invoice amounts change after preview", async () => {
  const first = { orders: [{ id: order.id, order_number: 12, order_date: "2026-10-12", updated_at: "2026-10-12T12:00:00Z", final_subtotal: 50, final_tax_amount: 0, final_total_amount: 50 }], startDate: "2026-10-12", endDate: "2026-10-12", subtotal: 50, tax: 0, total: 50 };
  const updated = { ...first, orders: [{ ...first.orders[0], final_total_amount: 60, final_subtotal: 60 }], subtotal: 60, total: 60 };
  vi.mocked(fetchCombinedInvoicePreview).mockResolvedValueOnce(first).mockResolvedValue(updated);
  const combine = vi.fn(async () => {});
  render(<CombineInvoicePreviewDialog filters={{branchId:"branch",startDate:"",endDate:""}} orderIds={[order.id]} branchName="Oshawa" onClose={() => {}} onCombine={combine}/>);
  const dialog = within(await screen.findByRole("dialog", {name:"Review combined invoice"}));
  await screen.findByText("1 order selected");
  await userEvent.click(dialog.getByRole("button", {name:"Confirm & Combine"}));
  expect(await screen.findByText(/These invoices changed/)).toBeVisible();
  expect(combine).not.toHaveBeenCalled();
  await userEvent.click(dialog.getByRole("button", {name:"Confirm & Combine"}));
  await waitFor(() => expect(combine).toHaveBeenCalledWith(updated));
});
