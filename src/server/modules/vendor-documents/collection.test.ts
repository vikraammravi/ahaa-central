import { File as ServerFile } from "node:buffer";
import { beforeEach, expect, it, vi } from "vitest";
import { queryResult } from "@tests/mocks/supabase";
import { purchaseReceipt, receiptUploadFile } from "@tests/mocks/receipts";
import { businessId, workspaceProfile } from "@tests/mocks/workspaces";
import { receiptAccess } from "./access";
import { POST } from "./collection";

vi.mock("./access", async original => ({ ...await original<typeof import("./access")>(), receiptAccess: vi.fn() }));
const storage = { upload: vi.fn() };
const database = { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn(() => storage) } };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  vi.stubGlobal("File", ServerFile);
  vi.mocked(receiptAccess).mockResolvedValue({ db: database, user: { id: workspaceProfile.id }, businessId, locationId: null } as unknown as Awaited<ReturnType<typeof receiptAccess>>);
  database.storage.from.mockReturnValue(storage);
  storage.upload.mockResolvedValue({ error: null });
});
function request() {
  const file = receiptUploadFile();
  const form = { get: (name: string) => name === "file" ? file : "prebuilt-invoice" };
  const request = new Request("https://app.test/api/receipts", { method: "POST" });
  vi.spyOn(request, "formData").mockResolvedValue(form as unknown as FormData);
  return request;
}

it.each([false, true])("restores exactly the stored original path (business prefix=%s)", async prefixed => {
  const filePath = `${prefixed ? businessId + "/" : ""}${purchaseReceipt.id}/original.pdf`;
  const lookup = queryResult({ ...purchaseReceipt, deleted_at: "2026-11-01", file_path: filePath });
  const update = queryResult(purchaseReceipt);
  database.from.mockReturnValueOnce(lookup).mockReturnValueOnce(update);
  const response = await POST(request());
  expect(response.status, response.status === 200 ? "" : await response.clone().text()).toBe(200);
  expect((await response.json()).restored).toBe(true);
  expect(storage.upload).toHaveBeenCalledWith(filePath, expect.any(Buffer), expect.objectContaining({ upsert: true }));
  expect(lookup.eq).toHaveBeenCalledWith("business_id", businessId);
  expect(update.eq).toHaveBeenCalledWith("business_id", businessId);
  expect(database.rpc).not.toHaveBeenCalled();
});

it("does not expose the stored path or upload again for an active duplicate", async () => {
  const lookup = queryResult({ ...purchaseReceipt, deleted_at: null, file_path: "private/original.pdf" });
  database.from.mockReturnValue(lookup);
  const response = await POST(request());
  const result = await response.json();
  expect(response.status, JSON.stringify(result)).toBe(200);
  expect(result.duplicate).toBe(true);
  expect(result.receipt).toEqual(purchaseReceipt);
  expect(result.receipt).not.toHaveProperty("file_path");
  expect(storage.upload).not.toHaveBeenCalled();
  expect(database.rpc).not.toHaveBeenCalled();
});
