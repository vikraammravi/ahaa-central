import { expect, it } from "vitest";
import { receiptFilters, emptyReceipt, extractReceipt, receiptWarnings, validReceiptDetails } from "./receipts";
import { invoiceScan, purchaseReceipt } from "@tests/mocks/receipts";
it("extracts invoice fields and flags low confidence without inventing missing amounts", () => {
  const result = extractReceipt(invoiceScan);
  expect(result.details).toEqual(purchaseReceipt.details);
  expect(result.warnings).toContain("Check TotalTax: scan confidence is low.");
  expect(extractReceipt({}).details.total).toBeNull();
});
it("maps retail receipt fields including currency and individual items", () => {
  const result = extractReceipt({ documents: [{ fields: { MerchantName: { valueString: "Costco" }, TransactionDate: { valueDate: "2026-10-30" }, Total: { valueCurrency: { amount: 7, currencyCode: "USD" } }, Items: { valueArray: [{ valueObject: { Name: { valueString: "Milk" }, TotalPrice: { valueCurrency: { amount: 7 } } } }] } } }] });
  expect(result.details).toMatchObject({ vendor: "Costco", currency: "USD", total: 7, items: [{ description: "Milk", quantity: null, unitPrice: null, amount: 7 }] });
});
it("flags incorrect totals and missing amounts for review", () => {
  expect(receiptWarnings(purchaseReceipt.details)).toEqual([]);
  expect(receiptWarnings({ ...purchaseReceipt.details, total: 99 })).toContain("Subtotal plus tax does not match the total. Check discounts, tips and other charges.");
  expect(receiptWarnings(emptyReceipt())).toHaveLength(3);
});
it("rejects malformed payloads, huge values and nonfinite amounts", () => {
  expect(validReceiptDetails(purchaseReceipt.details)).toBe(true);
  expect(validReceiptDetails({ ...purchaseReceipt.details, total: Infinity })).toBe(false);
  expect(validReceiptDetails({ ...purchaseReceipt.details, items: [{ description: 4 }] })).toBe(false);
  expect(validReceiptDetails(null)).toBe(false);
});

it("validates invoice filters and strips query operators from searches", () => {
 expect(receiptFilters(new URLSearchParams({ category: "Miscellaneous", status: "SAVED", search: "Costco,(status.eq.DRAFT)%" }))).toEqual({ category: "Miscellaneous", status: "SAVED", search: "Costco  status.eq.DRAFT" });
 expect(() => receiptFilters(new URLSearchParams({ status: "INVALID" }))).toThrow("Invalid invoice status");
 expect(() => receiptFilters(new URLSearchParams({ category: "Other" }))).toThrow("Invalid invoice category");
});
