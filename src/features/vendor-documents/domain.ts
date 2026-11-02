export type ReceiptItem = { description: string; quantity: number | null; unitPrice: number | null; amount: number | null };
export type ReceiptDetails = {
  vendor: string; invoiceNumber: string; date: string; currency: string;
  subtotal: number | null; tax: number | null; total: number | null; items: ReceiptItem[];
};
export type PurchaseReceipt = {
  id: string; file_name: string; category: string; status: "DRAFT" | "SAVED";
  details: ReceiptDetails; warnings: string[]; scan_status: string; created_at: string;
};
export const expenseCategories = ["Supplier Invoice", "Miscellaneous"];
export function emptyReceipt(): ReceiptDetails {
  return { vendor: "", invoiceNumber: "", date: "", currency: "CAD", subtotal: null, tax: null, total: null, items: [] };
}
type AzureField = { content?: string; valueString?: string; valueDate?: string; valueNumber?: number; valueCurrency?: { amount?: number; currencyCode?: string }; valueArray?: AzureField[]; valueObject?: Record<string, AzureField>; confidence?: number };
type AzureResult = { documents?: { fields?: Record<string, AzureField> }[]; pages?: unknown[] };
export function extractReceipt(result: AzureResult): { details: ReceiptDetails; warnings: string[] } {
  const fields = result.documents?.[0]?.fields ?? {};
  const text = (field?: AzureField) => field?.valueString ?? field?.valueDate ?? field?.content ?? "";
  const number = (field?: AzureField) => field?.valueCurrency?.amount ?? field?.valueNumber ?? null;
  const details: ReceiptDetails = {
    vendor: text(fields.VendorName ?? fields.MerchantName), invoiceNumber: text(fields.InvoiceId),
    date: text(fields.InvoiceDate ?? fields.TransactionDate),
    currency: (fields.InvoiceTotal ?? fields.Total)?.valueCurrency?.currencyCode ?? "CAD",
    subtotal: number(fields.SubTotal ?? fields.Subtotal), tax: number(fields.TotalTax ?? fields.Tax),
    total: number(fields.InvoiceTotal ?? fields.Total),
    items: (fields.Items?.valueArray ?? []).map(item => {
      const row = item.valueObject ?? {};
      return { description: text(row.Description ?? row.Name), quantity: number(row.Quantity), unitPrice: number(row.UnitPrice ?? row.Price), amount: number(row.Amount ?? row.TotalPrice) };
    }),
  };
  const warnings = Object.entries(fields).filter(([, f]) => f.confidence !== undefined && f.confidence < 0.85).map(([name]) => `Check ${name}: scan confidence is low.`);
  if ((result.documents?.length ?? 0) > 1) warnings.push("Multiple documents detected. Only the first was extracted; review the complete original.");
  warnings.push("Free-tier trial: only the first two pages are scanned. Check the original for additional pages.");
  return { details, warnings };
}
export function receiptWarnings(details: ReceiptDetails): string[] {
  const warnings: string[] = [];
  if (!details.vendor.trim()) warnings.push("Enter the vendor.");
  if (!details.date || !/^\d{4}-\d{2}-\d{2}$/.test(details.date) || Number.isNaN(Date.parse(details.date))) warnings.push("Enter the invoice date.");
  if (details.total === null) warnings.push("Enter the invoice total.");
  if (details.subtotal !== null && details.tax !== null && details.total !== null && Math.abs(details.subtotal + details.tax - details.total) > 0.02) warnings.push("Subtotal plus tax does not match the total. Check discounts, tips and other charges.");
  if (details.items.length && details.items.every(item => item.amount !== null) && details.subtotal !== null && Math.abs(details.items.reduce((sum, item) => sum + (item.amount ?? 0), 0) - details.subtotal) > 0.02) warnings.push("Item amounts do not match the subtotal. Check missing items and discounts.");
  return warnings;
}
export function validReceiptDetails(value: unknown): value is ReceiptDetails {
  if (!value || typeof value !== "object") return false;
  const d = value as ReceiptDetails;
  const amount = (n: unknown) => n === null || (typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10000000);
  return [d.vendor, d.invoiceNumber, d.date, d.currency].every(s => typeof s === "string" && s.length <= 300)
    && /^[A-Z]{3}$/.test(d.currency) && [d.subtotal, d.tax, d.total].every(amount)
    && Array.isArray(d.items) && d.items.length <= 300 && d.items.every(i => i && typeof i.description === "string" && i.description.length <= 1000 && [i.quantity, i.unitPrice, i.amount].every(amount));
}

// SAVED remains the persisted value; Completed is its user-facing label.
export function receiptFilters(params: URLSearchParams) {
  const category = params.get("category") || "";
  const status = params.get("status") || "";
  if (category && !expenseCategories.includes(category)) throw new Error("Invalid invoice category.");
  if (status && status !== "DRAFT" && status !== "SAVED") throw new Error("Invalid invoice status.");
  // Exclude PostgREST filter delimiters and wildcard operators from user input.
  const search = (params.get("search") || "").slice(0, 100).replace(/[^\p{L}\p{N}\s.@/#-]/gu, " ").trim();
  return { category, status, search };
}
