import { beforeEach, expect, it, vi } from "vitest";
import { queryResult } from "@tests/mocks/supabase";
import { businessId, workspaceProfile } from "@tests/mocks/workspaces";
import { purchaseReceipt } from "@tests/mocks/receipts";
import { receiptAccess } from "./access";
import { GET, POST } from "./document";

vi.mock("./access", async (importOriginal) => {
  const original = await importOriginal<typeof import("./access")>();
  return { ...original, receiptAccess: vi.fn() };
});
const storage = { createSignedUrl: vi.fn(), download: vi.fn() };
const database = { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn(() => storage) } };
const context = { params: Promise.resolve({ id: purchaseReceipt.id }) };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.stubEnv("AZURE_DOCUMENT_SCANNING_ENABLED", "true");
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://receipt-test.cognitiveservices.azure.com");
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "test-only");
  vi.mocked(receiptAccess).mockResolvedValue({ db: database, user: { id: workspaceProfile.id }, businessId, locationId: workspaceProfile.location_id } as unknown as Awaited<ReturnType<typeof receiptAccess>>);
});
it("applies business and branch scope before signing an authorized original", async () => {
  const query = queryResult({ file_path: `${businessId}/receipt/original.pdf` });
  database.from.mockReturnValue(query);
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://files.example.invalid/signed" }, error: null });
  const response = await GET(new Request(`https://app.test/api/receipts/${purchaseReceipt.id}?original=1`), context);
  expect(response.status).toBe(307);
  expect(query.eq).toHaveBeenCalledWith("business_id", businessId);
  expect(query.eq).toHaveBeenCalledWith("location_id", workspaceProfile.location_id);
  expect(query.eq).toHaveBeenCalledWith("id", purchaseReceipt.id);
  expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  expect(storage.createSignedUrl).toHaveBeenCalledWith(`${businessId}/receipt/original.pdf`, 120);
});
it("never signs or scans an original when the scoped record is inaccessible", async () => {
  const query = queryResult(null);
  database.from.mockReturnValue(query);
  const view = await GET(new Request(`https://app.test/api/receipts/${purchaseReceipt.id}?original=1`), context);
  expect(view.status).toBe(400);
  expect(query.eq).toHaveBeenCalledWith("business_id", businessId);
  expect(query.eq).toHaveBeenCalledWith("location_id", workspaceProfile.location_id);
  expect(storage.createSignedUrl).not.toHaveBeenCalled();
  expect(storage.download).not.toHaveBeenCalled();
  expect(database.rpc).not.toHaveBeenCalled();
  const scan = await POST(new Request(`https://app.test/api/receipts/${purchaseReceipt.id}`, { method: "POST" }), context);
  expect(scan.status).not.toBe(200);
  expect(storage.download).not.toHaveBeenCalled();
  expect(database.rpc).not.toHaveBeenCalled();
});
