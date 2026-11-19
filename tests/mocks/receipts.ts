import type { PurchaseReceipt } from "@/features/vendor-documents/domain";
export const receiptUploadFile = () => new File(["%PDF-test"], "invoice.pdf", { type: "application/pdf" });
export const invoiceScan = { documents: [{ fields: {
  VendorName: { valueString: "Bombay Foods", confidence: 0.98 },
  InvoiceId: { valueString: "INV-104" }, InvoiceDate: { valueDate: "2026-10-30" },
  SubTotal: { valueCurrency: { amount: 20 } }, TotalTax: { valueCurrency: { amount: 2.6 }, confidence: 0.6 },
  InvoiceTotal: { valueCurrency: { amount: 22.6, currencyCode: "CAD" } },
  Items: { valueArray: [{ valueObject: { Description: { valueString: "Rice" }, Quantity: { valueNumber: 2 }, UnitPrice: { valueCurrency: { amount: 10 } }, Amount: { valueCurrency: { amount: 20 } } } }] },
} }] };
export const multiSectionScan = { documents: [invoiceScan.documents[0], { fields: {
  InvoiceTotal: { valueCurrency: { amount: 33.9 } },
  Items: { valueArray: [{ valueObject: { Description: { valueString: "Flour" }, Quantity: { valueNumber: 1 }, UnitPrice: { valueCurrency: { amount: 10 } }, Amount: { valueCurrency: { amount: 10 } } } }] },
} }] };
// Synthetic Azure layout: the structured model merged distinct product rows.
export const mergedInvoiceTableScan = {
  documents: [{ fields: {
    VendorName: { valueString: "Example Supplier" }, InvoiceId: { valueString: "TEST-1" },
    InvoiceDate: { valueDate: "2026-11-17" }, SubTotal: { valueCurrency: { amount: 53 } },
    TotalTax: { valueCurrency: { amount: 0 } }, InvoiceTotal: { valueCurrency: { amount: 53 } },
    Items: { valueArray: [{ valueObject: { Description: { valueString: "Alpha Beta Gamma Delta" }, Quantity: { valueNumber: 1 }, Amount: { valueCurrency: { amount: 10 } } } }] },
  } }],
  tables: [{ rowCount: 5, columnCount: 5, cells: [
    ...["Sr.No", "Product Name", "QTY", "RATE", "AMOUNT"].map((content, columnIndex) => ({ rowIndex: 0, columnIndex, kind: "columnHeader", content })),
    ...[["1", "Alpha", "1", "10.00", "10.00"], ["2", "Beta", "2", "5.00", "10.00"], ["3", "Gamma", "1", "25.00", "25.00"], ["4", "Delta", "2", "4.00", "8.00"]].flatMap((row, index) => row.map((content, columnIndex) => ({ rowIndex: index + 1, columnIndex, content }))),
  ] }],
};
export const purchaseReceipt: PurchaseReceipt = {
  id: "00000000-0000-4000-8000-000000000001", file_name: "invoice.pdf", category: "Supplier Invoice", status: "DRAFT", scan_status: "SUCCEEDED", warnings: [], created_at: "2026-10-30T12:00:00Z",
  details: { vendor: "Bombay Foods", invoiceNumber: "INV-104", date: "2026-10-30", currency: "CAD", subtotal: 20, tax: 2.6, total: 22.6, items: [{ description: "Rice", quantity: 2, unitPrice: 10, amount: 20 }] },
};
