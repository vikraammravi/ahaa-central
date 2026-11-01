import type { PurchaseReceipt } from "@/lib/receipts";
export const receiptUploadFile = () => new File(["%PDF-test"], "invoice.pdf", { type: "application/pdf" });
export const invoiceScan = { documents: [{ fields: {
  VendorName: { valueString: "Bombay Foods", confidence: 0.98 },
  InvoiceId: { valueString: "INV-104" }, InvoiceDate: { valueDate: "2026-10-30" },
  SubTotal: { valueCurrency: { amount: 20 } }, TotalTax: { valueCurrency: { amount: 2.6 }, confidence: 0.6 },
  InvoiceTotal: { valueCurrency: { amount: 22.6, currencyCode: "CAD" } },
  Items: { valueArray: [{ valueObject: { Description: { valueString: "Rice" }, Quantity: { valueNumber: 2 }, UnitPrice: { valueCurrency: { amount: 10 } }, Amount: { valueCurrency: { amount: 20 } } } }] },
} }] };
export const purchaseReceipt: PurchaseReceipt = {
  id: "00000000-0000-4000-8000-000000000001", file_name: "invoice.pdf", category: "Supplier Invoice", status: "DRAFT", scan_status: "SUCCEEDED", warnings: [], created_at: "2026-10-30T12:00:00Z",
  details: { vendor: "Bombay Foods", invoiceNumber: "INV-104", date: "2026-10-30", currency: "CAD", subtotal: 20, tax: 2.6, total: 22.6, items: [{ description: "Rice", quantity: 2, unitPrice: 10, amount: 20 }] },
};
