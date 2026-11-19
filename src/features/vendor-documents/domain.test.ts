import { expect, it } from "vitest";
import { receiptFilters, emptyReceipt, extractReceipt, receiptWarnings, validReceiptDetails } from "./domain";
import { invoiceScan, mergedInvoiceTableScan, multiSectionScan, purchaseReceipt } from "@tests/mocks/receipts";
it("extracts invoice fields and flags low confidence without inventing missing amounts", () => {
  const result = extractReceipt(invoiceScan);
  expect(result.details).toEqual(purchaseReceipt.details);
  expect(result.warnings).toContain("Check TotalTax: scan confidence is low.");
  expect(extractReceipt({}).details.total).toBeNull();
});
it("preserves items and invoice fields across scanned document sections", () => {
 const result = extractReceipt(multiSectionScan);
 expect(result.details.vendor).toBe("Bombay Foods");
 expect(result.details.items.map(item => item.description)).toEqual(["Rice", "Flour"]);
 expect(result.warnings).toContain("Multiple sections detected. Review all items and amounts against the original for duplicates, omissions, or conflicting totals.");
});
it("maps retail receipt fields including currency and individual items", () => {
  const result = extractReceipt({ documents: [{ fields: { MerchantName: { valueString: "Costco" }, TransactionDate: { valueDate: "2026-10-30" }, Total: { valueCurrency: { amount: 7, currencyCode: "USD" } }, Items: { valueArray: [{ valueObject: { Name: { valueString: "Milk" }, TotalPrice: { valueCurrency: { amount: 7 } } } }] } } }] });
  expect(result.details).toMatchObject({ vendor: "Costco", currency: "USD", total: 7, items: [{ description: "Milk", quantity: null, unitPrice: null, amount: 7 }] });
});
it("recovers distinct invoice items from a matching, balanced layout table", () => {
  const result = extractReceipt(mergedInvoiceTableScan);
  expect(result.details.items).toEqual([
    { description: "Alpha", quantity: 1, unitPrice: 10, amount: 10 },
    { description: "Beta", quantity: 2, unitPrice: 5, amount: 10 },
    { description: "Gamma", quantity: 1, unitPrice: 25, amount: 25 },
    { description: "Delta", quantity: 2, unitPrice: 4, amount: 8 },
  ]);
  expect(result.details).toMatchObject({ subtotal: 53, total: 53 });
  expect(result.warnings).toContain("Items recovered from the invoice table. Check every item and amount against the original before saving.");
});
it.each(["ambiguous", "bad amount", "missing quantity", "wrong subtotal", "missing header"])('does not replace structured items when table evidence is %s', scenario => {
  const input = structuredClone(mergedInvoiceTableScan);
  if (scenario === "ambiguous") input.tables.push(structuredClone(input.tables[0]));
  if (scenario === "bad amount") input.tables[0].cells.find(cell => cell.rowIndex === 2 && cell.columnIndex === 4)!.content = "11.00";
  if (scenario === "missing quantity") input.tables[0].cells.find(cell => cell.rowIndex === 3 && cell.columnIndex === 2)!.content = "";
  if (scenario === "wrong subtotal") input.documents[0].fields.SubTotal.valueCurrency.amount = 54;
  if (scenario === "missing header") input.tables[0].cells.find(cell => cell.rowIndex === 0 && cell.columnIndex === 1)!.content = "Unknown";
  const result = extractReceipt(input);
  expect(result.details.items).toHaveLength(1);
  expect(result.details.items[0].description).toBe("Alpha Beta Gamma Delta");
  expect(result.warnings).not.toContain("Items recovered from the invoice table. Check every item and amount against the original before saving.");
});
it("does not apply invoice table recovery to a retail receipt", () => {
  const input = structuredClone(mergedInvoiceTableScan);
  const receipt = { ...input, documents: [{ fields: { MerchantName: { valueString: "Retail shop" }, Total: { valueCurrency: { amount: 53 } }, Items: input.documents[0].fields.Items } }] };
  expect(extractReceipt(receipt).details.items).toHaveLength(1);
});
it("does not replace items from multiple detected document sections with one table", () => {
  const input = structuredClone(mergedInvoiceTableScan);
  input.documents.push({ fields: { ...structuredClone(input.documents[0].fields), Items: { valueArray: [{ valueObject: { Description: { valueString: "Other page item" }, Quantity: { valueNumber: 1 }, Amount: { valueCurrency: { amount: 12 } } } }] } } });
  const result = extractReceipt(input);
  expect(result.details.items.map(item => item.description)).toEqual(["Alpha Beta Gamma Delta", "Other page item"]);
  expect(result.warnings).toContain("Multiple sections detected. Review all items and amounts against the original for duplicates, omissions, or conflicting totals.");
});
it("flags incorrect totals and missing amounts for review", () => {
  expect(receiptWarnings(purchaseReceipt.details)).toEqual([]);
  expect(receiptWarnings({ ...purchaseReceipt.details, total: 99 })).toContain("Subtotal plus tax does not match the total. Check discounts, tips and other charges.");
  expect(receiptWarnings(emptyReceipt())).toHaveLength(3);
});
it("warns when an extracted invoice item lacks an amount, but not for an empty item list", () => {
  const incomplete = { ...purchaseReceipt.details, items: [{ description: "Item", quantity: 1, unitPrice: 20, amount: null }] };
  expect(receiptWarnings(incomplete)).toContain("Some item amounts are missing. Check all items against the original.");
  expect(receiptWarnings({ ...purchaseReceipt.details, items: [] })).not.toContain("Some item amounts are missing. Check all items against the original.");
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
