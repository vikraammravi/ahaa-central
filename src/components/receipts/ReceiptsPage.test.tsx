import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceiptsPage from "./ReceiptsPage";
import { purchaseReceipt, receiptUploadFile } from "@tests/mocks/receipts";
beforeEach(() => {
 vi.mocked(fetch).mockImplementation(async (url, options) => {
  if (options?.method === "PATCH") return Response.json({ receipt: { ...purchaseReceipt, status: "SAVED" } });
  if (String(url).includes(purchaseReceipt.id)) return Response.json({ receipt: purchaseReceipt });
  const completed = vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "PATCH");
  return Response.json({ rows: [{ ...purchaseReceipt, status: completed ? "SAVED" : "DRAFT" }], count: 50 });
 });
});
it("marks a reviewed draft completed and returns to the list", async () => {
 render(<ReceiptsPage />);
 expect(await screen.findByText("Draft", { selector: "span" })).toBeVisible();
 await userEvent.click(screen.getByRole("button", { name: "Edit" }));
 await userEvent.click(await screen.findByRole("checkbox", { name: "I reviewed the original receipt" }));
 await userEvent.click(screen.getByRole("button", { name: "Save reviewed receipt" }));
 expect(await screen.findByText("Completed", { selector: "span" })).toBeVisible();
 expect(screen.getByRole("status")).toHaveTextContent("completed successfully");
 const save = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
 expect(JSON.parse(save![1]!.body as string)).toMatchObject({ reviewed: true, category: "Supplier Invoice" });
});
it("filters the full list and resets pagination when filters change", async () => {
 render(<ReceiptsPage />);
 await screen.findByRole("button", { name: "Edit" });
 await userEvent.click(screen.getByRole("button", { name: "Next" }));
 await waitFor(() => expect(String(vi.mocked(fetch).mock.lastCall?.[0])).toContain("page=1"));
 await userEvent.selectOptions(screen.getByLabelText("Category"), "Miscellaneous");
 await userEvent.selectOptions(screen.getByLabelText("Status"), "SAVED");
 await userEvent.type(screen.getByLabelText("Search invoices"), "Costco");
 await waitFor(() => {
  const params = new URL(String(vi.mocked(fetch).mock.lastCall?.[0]), "https://test.invalid").searchParams;
  expect(Object.fromEntries(params)).toEqual({ page: "0", category: "Miscellaneous", status: "SAVED", search: "Costco" });
 });
});


it("shows loading instead of an empty list while the initial request is pending", async () => {
 let finish!: (response: Response) => void;
 vi.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
 render(<ReceiptsPage />);
 expect(screen.getByRole("status")).toHaveTextContent("Loading invoices");
 expect(screen.queryByText("No vendor invoices found")).not.toBeInTheDocument();
 await act(async () => finish(Response.json({ rows: [purchaseReceipt], count: 1 })));
 expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible();
});
it("shows the returned draft immediately and retains rows during a slow upload refresh", async () => {
 let finish!: (response: Response) => void;
 let uploaded = false;
 const draft = { ...purchaseReceipt, id: "00000000-0000-4000-8000-000000000002", details: { ...purchaseReceipt.details, vendor: "New vendor" } };
 vi.mocked(fetch).mockImplementation(async (_url, init) => {
  if (init?.method === "POST") { uploaded = true; return Response.json({ receipt: draft }); }
  if (uploaded) return new Promise(resolve => { finish = resolve; });
  return Response.json({ rows: [purchaseReceipt], count: 1 });
 });
 render(<ReceiptsPage />);
 await screen.findByRole("button", { name: "Edit" });
 await userEvent.click(screen.getByRole("button", { name: "Upload invoice" }));
 await userEvent.upload(screen.getByLabelText("Invoice file"), receiptUploadFile());
 await userEvent.click(screen.getByRole("button", { name: "Upload draft" }));
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(screen.getByText("New vendor")).toBeVisible();
 expect(screen.getByText("Bombay Foods")).toBeVisible();
 expect(screen.getByText("Updating invoices…")).toBeVisible();
 await act(async () => finish(Response.json({ rows: [draft, purchaseReceipt], count: 2 })));
 await waitFor(() => expect(screen.queryByText("Updating invoices…")).not.toBeInTheDocument());
});
