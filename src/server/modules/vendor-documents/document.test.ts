import { beforeEach, expect, it, vi } from "vitest";
import { queryResult } from "@tests/mocks/supabase";
import { purchaseReceipt } from "@tests/mocks/receipts";
import { receiptAccess } from "@/server/modules/vendor-documents/access";
import { POST, PATCH, GET, DELETE } from "./document";
import { businessId } from "@tests/mocks/workspaces";

vi.mock("@/server/modules/vendor-documents/access", () => ({
  receiptAccess: vi.fn(),
  receiptError: (error: Error) => Response.json({ error: error.message }, { status: 400 }),
  receiptScope: (query: unknown) => query,
  receiptSelection: "id,file_name,category,status,details,warnings,scan_status,created_at",

}));
const context = { params: Promise.resolve({ id: purchaseReceipt.id }) };
const storage = { download: vi.fn(), createSignedUrl: vi.fn() };
const database = { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } };
function request(method: string, body?: unknown) {
  return new Request(`https://app.test/api/admin/receipts/${purchaseReceipt.id}`, { method, headers: { origin: "https://app.test", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.stubEnv("AZURE_DOCUMENT_SCANNING_ENABLED", "true");
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://receipt-test.cognitiveservices.azure.com");
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "test-only");
  vi.mocked(receiptAccess).mockResolvedValue({ db: database, user: { id: "admin-test" } } as unknown as Awaited<ReturnType<typeof receiptAccess>>);
  database.from.mockReturnValue(queryResult({ file_path: "private/original.pdf", model: "prebuilt-invoice" }));
  database.storage.from.mockReturnValue(storage);
  storage.download.mockResolvedValue({ data: new Blob(["test"], { type: "application/pdf" }), error: null });
});
it("does not contact Azure when a scan reservation is denied", async () => {
  database.rpc.mockResolvedValue({ data: false, error: null });
  const response = await POST(request("POST"), context);
  expect(response.status).toBe(429);
  expect(fetch).not.toHaveBeenCalled();
  expect(storage.download).not.toHaveBeenCalled();
  expect(database.rpc).toHaveBeenCalledWith("reserve_receipt_scan", { p_receipt_id: purchaseReceipt.id, p_user_id: "admin-test" });
});
it("passes the authorized business to the new reservation and still denies Azure when quota is refused", async () => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.mocked(receiptAccess).mockResolvedValue({ db: database, user: { id: "admin-test" }, businessId, locationId: null } as unknown as Awaited<ReturnType<typeof receiptAccess>>);
  database.rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(request("POST"), context)).status).toBe(429);
  expect(database.rpc).toHaveBeenCalledWith("reserve_receipt_scan_for_business", { p_business_id: businessId, p_receipt_id: purchaseReceipt.id, p_user_id: "admin-test" });
  expect(fetch).not.toHaveBeenCalled();
  expect(storage.download).not.toHaveBeenCalled();
});
it("stops before file access when authorization fails", async () => {
  vi.mocked(receiptAccess).mockRejectedValue(new Error("Sign in first."));
  await POST(request("POST"), context);
  expect(database.from).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects unreviewed or malformed saves without updating records", async () => {
  const response = await PATCH(request("PATCH", { details: purchaseReceipt.details, category: "Supplier Invoice", reviewed: false }), context);
  expect((await response.json()).error).toContain("reviewed");
  expect(database.from).not.toHaveBeenCalled();
  const malformed = await PATCH(request("PATCH", { details: { items: [null] }, category: "Supplier Invoice", reviewed: true }), context);
  expect(malformed.status).toBe(400);
});
it("does not return private file paths, operation URLs or usage counters", async () => {
  database.from.mockReturnValue(queryResult({ ...purchaseReceipt, file_path: "private/path", operation_url: "private-operation", scan_usage: { month: 10 } }));
  const response = await GET(request("GET"), context);
  const body = await response.json();
  expect(body.receipt).toEqual(purchaseReceipt);
  expect(body.receipt).not.toHaveProperty("file_path");
  expect(body.receipt).not.toHaveProperty("scan_usage");
});

it("soft-deletes without resetting usage or removing the original, and guards running scans", async () => {
  const query = queryResult({ id: purchaseReceipt.id });
  database.from.mockReturnValue(query);
  const response = await DELETE(request("DELETE"), context);
  expect(response.status).toBe(200);
  expect(query.update).toHaveBeenCalledWith({ deleted_at: expect.any(String), updated_at: expect.any(String) });
  expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  expect(query.neq).toHaveBeenCalledWith("scan_status", "RUNNING");
  expect(query.delete).not.toHaveBeenCalled();
  expect(storage.download).not.toHaveBeenCalled();
});

it("does not delete an invoice if no eligible active row was updated", async () => {
  database.from.mockReturnValue(queryResult(null));
  const response = await DELETE(request("DELETE"), context);
  expect((await response.json()).error).toContain("Wait for any running scan");
});

it("fails closed when quota storage is unavailable", async () => {
 database.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
 const response = await POST(request("POST"), context);
 expect(response.status).toBe(400);
 expect(fetch).not.toHaveBeenCalled();
 expect(storage.download).not.toHaveBeenCalled();
});
