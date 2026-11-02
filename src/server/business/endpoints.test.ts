import { beforeEach, expect, it, vi } from "vitest";
import { createBranchUser, removeBranchUser, updateBranchUser } from "./users/endpoints";
import { listReceipts, uploadReceipt, readReceipt, rescanReceipt, saveReceipt, deleteReceipt } from "./vendor-documents/endpoints";
import { viewInvoicePdf } from "./billing/endpoints";
const handlers = vi.hoisted(() => ({ legacyCreate: vi.fn(), legacyDelete: vi.fn(), create: vi.fn(), remove: vi.fn(), update: vi.fn(), receipt: vi.fn(), pdf: vi.fn() }));
vi.mock("./users/create-user", () => ({ POST: handlers.legacyCreate }));
vi.mock("./users/delete-user", () => ({ DELETE: handlers.legacyDelete }));
vi.mock("./users/workspace-users", () => ({ createBusinessUser: handlers.create, removeBusinessUser: handlers.remove, updateBusinessUser: handlers.update }));
vi.mock("./vendor-documents/collection", () => ({ GET: handlers.receipt, POST: handlers.receipt }));
vi.mock("./vendor-documents/document", () => ({ GET: handlers.receipt, POST: handlers.receipt, PATCH: handlers.receipt, DELETE: handlers.receipt }));
vi.mock("./billing/pdf-handler", () => ({ GET: handlers.pdf }));
beforeEach(() => { for (const handler of Object.values(handlers)) handler.mockImplementation(() => Response.json({ ok: true })); });
it("rejects every business API on the platform without running a business operation", async () => {
  vi.stubEnv("APP_SURFACE", "platform");
  const request = new Request("https://platform.test/api/receipts");
  const context = { params: Promise.resolve({ id: "blocked" }) };
  const operations = [() => createBranchUser(request), () => removeBranchUser(request, context), () => updateBranchUser(request, context),
    () => listReceipts(request), () => uploadReceipt(request), () => readReceipt(request, context), () => rescanReceipt(request, context),
    () => saveReceipt(request, context), () => deleteReceipt(request, context), () => viewInvoicePdf(request, { params: Promise.resolve({ kind: "individual", id: "blocked" }) })];
  for (const operation of operations) {
    const response = await operation();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
});
it("preserves legacy account dispatch with workspace mode disabled", async () => {
  vi.stubEnv("APP_SURFACE", "business"); vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "false");
  const request = new Request("https://business.test/api/admin/branch-users");
  const context = { params: Promise.resolve({ id: "user" }) };
  await createBranchUser(request); await removeBranchUser(request, context);
  expect(handlers.legacyCreate).toHaveBeenCalledWith(request);
  expect(handlers.legacyDelete).toHaveBeenCalledWith(request, context);
  expect(handlers.create).not.toHaveBeenCalled(); expect(handlers.remove).not.toHaveBeenCalled();
});
it("uses membership-aware account handlers with workspace mode enabled", async () => {
  vi.stubEnv("APP_SURFACE", "business"); vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  const request = new Request("https://business.test/api/admin/branch-users");
  const context = { params: Promise.resolve({ id: "user" }) };
  await createBranchUser(request); await removeBranchUser(request, context);
  expect(handlers.create).toHaveBeenCalledWith(request);
  expect(handlers.remove).toHaveBeenCalledWith(request, context);
  expect(handlers.legacyCreate).not.toHaveBeenCalled(); expect(handlers.legacyDelete).not.toHaveBeenCalled();
});
it("preserves receipt request context and operation errors on the business surface", async () => {
  vi.stubEnv("APP_SURFACE", "business");
  const request = new Request("https://business.test/api/receipts/id");
  const context = { params: Promise.resolve({ id: "receipt" }) };
  expect((await readReceipt(request, context)).status).toBe(200);
  expect(handlers.receipt).toHaveBeenCalledWith(request, context);
  handlers.receipt.mockRejectedValue(new Error("Operation failed"));
  await expect(readReceipt(request, context)).rejects.toThrow("Operation failed");
});
