import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { receiptUploadFile } from "@tests/mocks/receipts";
import { ReceiptUploadDialog } from "./ReceiptUploadDialog";

it("uploads a selected file as a draft and closes only after success", async () => {
  const upload = vi.fn().mockResolvedValue(undefined);
  render(<ReceiptUploadDialog onUpload={upload} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Upload invoice" }));
  expect(screen.getByRole("button", { name: "Upload draft" })).toBeDisabled();
  const file = receiptUploadFile();
  await userEvent.upload(screen.getByLabelText("Invoice file"), file);
  await userEvent.click(screen.getByRole("button", { name: "Upload draft" }));
  expect(upload).toHaveBeenCalledWith(file, "prebuilt-invoice");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("keeps the file and dialog available when upload fails", async () => {
  render(<ReceiptUploadDialog onUpload={vi.fn().mockRejectedValue(new Error("Upload failed"))} />);
  await userEvent.click(screen.getByRole("button", { name: "Upload invoice" }));
  await userEvent.upload(screen.getByLabelText("Invoice file"), receiptUploadFile());
  await userEvent.click(screen.getByRole("button", { name: "Upload draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("button", { name: "Upload draft" })).toBeEnabled();
});
