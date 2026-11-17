import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptReview } from "./ReceiptReview";
import { purchaseReceipt } from "@tests/mocks/receipts";
it("requires review confirmation and saves corrected details", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={save} onScan={vi.fn()} onClose={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Save reviewed receipt" });
  expect(button).toBeDisabled();
  await userEvent.clear(screen.getByLabelText(/^Vendor/));
  await userEvent.type(screen.getByLabelText(/^Vendor/), "Costco");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(button);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ vendor: "Costco" }), "Supplier Invoice");
});
it("does not rescan until the replacement confirmation is accepted", async () => {
  const scan = vi.fn().mockResolvedValue(undefined);
  render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={vi.fn()} onScan={scan} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Rescan" }));
  expect(scan).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Scan receipt" }));
  expect(scan).toHaveBeenCalledTimes(1);
});
it("supports adding and removing items and blocks edits while scanning", async () => {
  const view = render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(screen.getByLabelText("Item 2")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
  expect(screen.queryByLabelText("Item 2")).not.toBeInTheDocument();
  view.rerender(<ReceiptReview receipt={{ ...purchaseReceipt, scan_status: "RUNNING" }} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByLabelText(/^Vendor/)).toBeDisabled();
});

it("shows save failures beside the save action and keeps corrected details", async () => {
  render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={vi.fn().mockRejectedValue(new Error("Unable to save invoice"))} onScan={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Save reviewed receipt" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save invoice");
  expect(screen.getByLabelText(/^Vendor/)).toHaveValue(purchaseReceipt.details.vendor);
});

it("opens the original separately and hides currency and extraction warnings", () => {
 render(<ReceiptReview receipt={{ ...purchaseReceipt, warnings: ["Check VendorName: scan confidence is low."] }} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
 expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
 expect(screen.queryByTitle("Original receipt")).not.toBeInTheDocument();
 expect(screen.queryByText(/scan confidence is low/)).not.toBeInTheDocument();
 expect(screen.getByRole("link", { name: "View original" })).toHaveAttribute("target", "_blank");
});

it("keeps completed invoices read-only and hides Rescan until Edit is selected", async () => {
 const save = vi.fn().mockResolvedValue(undefined);
 render(<ReceiptReview receipt={{ ...purchaseReceipt, status: "SAVED" }} busy={false} onSave={save} onScan={vi.fn()} onClose={vi.fn()} />);
 expect(screen.getByLabelText(/^Vendor/)).toBeDisabled();
 expect(screen.getByLabelText("Category")).toBeDisabled();
 expect(screen.getByLabelText("Total")).toBeDisabled();
 expect(screen.getByLabelText("Item 1")).toBeDisabled();
 expect(screen.queryByRole("button", { name: "Save reviewed receipt" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Rescan" })).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole("button", { name: "Edit" }));
 expect(screen.getByLabelText(/^Vendor/)).toBeEnabled();
 expect(screen.getByRole("button", { name: "Rescan" })).toBeEnabled();
 expect(screen.getByLabelText("Category")).toBeEnabled();
 await userEvent.click(screen.getByRole("checkbox"));
 await userEvent.click(screen.getByRole("button", { name: "Save reviewed receipt" }));
 expect(save).toHaveBeenCalledWith(purchaseReceipt.details, purchaseReceipt.category);
});
it("can cancel an unchanged edit and lock the completed invoice again", async () => {
 render(<ReceiptReview receipt={{ ...purchaseReceipt, status: "SAVED" }} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
 await userEvent.click(screen.getByRole("button", { name: "Edit" }));
 await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
 expect(screen.getByLabelText(/^Vendor/)).toBeDisabled();
 expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

it("calculates item and invoice totals from the entered values and saves them", async () => {
 const save = vi.fn().mockResolvedValue(undefined);
 render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={save} onScan={vi.fn()} onClose={vi.fn()} />);
 const quantity = screen.getByLabelText("Quantity");
 const price = screen.getByLabelText("Unit price");
 await userEvent.clear(quantity);
 expect(screen.getByLabelText("Amount")).toHaveValue(null);
 await userEvent.type(quantity, "3");
 await userEvent.clear(price);
 await userEvent.type(price, "4.25");
 expect(screen.getByLabelText("Amount")).toHaveValue(12.75);
 await userEvent.clear(screen.getByLabelText("Subtotal"));
 await userEvent.type(screen.getByLabelText("Subtotal"), "12.75");
 await userEvent.clear(screen.getByLabelText("Tax amount"));
 expect(screen.getByLabelText("Total")).toHaveValue(null);
 await userEvent.type(screen.getByLabelText("Tax amount"), "1.66");
 expect(screen.getByLabelText("Total")).toHaveValue(14.41);
 await userEvent.click(screen.getByRole("checkbox"));
 await userEvent.click(screen.getByRole("button", { name: "Save reviewed receipt" }));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 12.75, tax: 1.66, total: 14.41, items: [expect.objectContaining({ quantity: 3, unitPrice: 4.25, amount: 12.75 })] }), "Supplier Invoice");
});

it("rounds calculated values to cents", async () => {
 render(<ReceiptReview receipt={purchaseReceipt} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
 await userEvent.clear(screen.getByLabelText("Quantity"));
 await userEvent.type(screen.getByLabelText("Quantity"), "3");
 await userEvent.clear(screen.getByLabelText("Unit price"));
 await userEvent.type(screen.getByLabelText("Unit price"), "0.335");
 expect(screen.getByLabelText("Amount")).toHaveValue(1.01);
 await userEvent.clear(screen.getByLabelText("Quantity"));
 await userEvent.type(screen.getByLabelText("Quantity"), "1");
 await userEvent.clear(screen.getByLabelText("Unit price"));
 await userEvent.type(screen.getByLabelText("Unit price"), "10.075");
 expect(screen.getByLabelText("Amount")).toHaveValue(10.08);
 await userEvent.clear(screen.getByLabelText("Subtotal"));
 await userEvent.type(screen.getByLabelText("Subtotal"), "10.075");
 await userEvent.clear(screen.getByLabelText("Tax amount"));
 await userEvent.type(screen.getByLabelText("Tax amount"), "0");
 expect(screen.getByLabelText("Total")).toHaveValue(10.08);
});

it("shows the warning when the scan detected multiple sections", () => {
 const warning = "Multiple sections detected. Review all items and amounts against the original for duplicates, omissions, or conflicting totals.";
 render(<ReceiptReview receipt={{ ...purchaseReceipt, warnings: [warning] }} busy={false} onSave={vi.fn()} onScan={vi.fn()} onClose={vi.fn()} />);
 expect(screen.getByText(warning)).toBeVisible();
});
