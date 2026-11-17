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
  expect(upload).toHaveBeenCalledWith([file], "prebuilt-invoice");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("uploads two photos in the order selected", async () => {
  const upload = vi.fn().mockResolvedValue(undefined);
  const photos = [new File(["first"], "page-1.jpg", { type: "image/jpeg" }), new File(["second"], "page-2.png", { type: "image/png" })];
  render(<ReceiptUploadDialog onUpload={upload} />);
  await userEvent.click(screen.getByRole("button", { name: "Upload invoice" }));
  await userEvent.upload(screen.getByLabelText("Invoice file"), photos);
  expect(screen.getByText("page-1.jpg")).toBeVisible();
  expect(screen.getByText("page-2.png")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Upload draft" }));
  expect(upload).toHaveBeenCalledWith(photos, "prebuilt-invoice");
});

it.each([
  ["three photos", ["image/jpeg", "image/png", "image/jpeg"]],
  ["a PDF and a photo", ["application/pdf", "image/jpeg"]],
])("rejects %s before uploading", async (_description, types) => {
  const upload = vi.fn();
  const files = types.map((type, i) => new File(["x"], `page-${i}`, { type }));
  render(<ReceiptUploadDialog onUpload={upload} />);
  await userEvent.click(screen.getByRole("button", { name: "Upload invoice" }));
  await userEvent.upload(screen.getByLabelText("Invoice file"), files);
  await userEvent.click(screen.getByRole("button", { name: "Upload draft" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose one PDF or up to two");
  expect(upload).not.toHaveBeenCalled();
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
