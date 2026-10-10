import type { Order } from "./supabase/types";
import type { OrderLine } from "./supabase/types";
import { localDateInput } from "./catering";
import { TAX_RATE } from "./format";

export function invoiceDateKey(order: Pick<Order, "order_date" | "created_at">): string {
  return order.order_date || localDateInput(new Date(order.created_at));
}

export function invoiceMatchesFilters(
  order: Pick<Order, "order_date" | "created_at" | "location_id">,
  filters: { startDate: string; endDate: string; branchId: string },
) {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) return false;
  const date = invoiceDateKey(order);
  return (!filters.startDate || date >= filters.startDate) &&
    (!filters.endDate || date <= filters.endDate) &&
    (!filters.branchId || order.location_id === filters.branchId);
}

export type InvoiceEditLine = OrderLine & { catalog_items: { name: string; unit_type: string } | null };
export type InvoiceLineDraft = { quantity: string; unitPrice: string; taxable: boolean; returnToStock?: boolean };

export function invoiceNeedsSending(order: Pick<Order, "invoice_sent_at" | "invoice_revision" | "invoice_sent_revision">): boolean {
  return !order.invoice_sent_at || order.invoice_revision !== order.invoice_sent_revision;
}

export function invoiceDraftError(lines: InvoiceEditLine[], drafts: Record<string, InvoiceLineDraft>): string | null {
  if (!lines.length) return "The invoice has no items to edit.";
  for (const line of lines) {
    const draft = drafts[line.id];
    if (!draft || draft.quantity.trim() === "" || draft.unitPrice.trim() === "") return "Enter a quantity and unit price for every item.";
    const quantity = Number(draft.quantity);
    const price = Number(draft.unitPrice);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > line.quantity) return "Billed quantity must be a whole number between zero and the original requested quantity.";
    if (!Number.isFinite(price) || price < 0 || price > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(draft.unitPrice.trim())) return "Unit price must be zero or more, with no more than two decimal places.";
  }
  return null;
}

export function invoiceDraftTotals(lines: InvoiceEditLine[], drafts: Record<string, InvoiceLineDraft>) {
  const subtotal = lines.reduce((sum, line) => sum + Number(drafts[line.id]?.quantity ?? line.fulfilled_quantity) * Number(drafts[line.id]?.unitPrice ?? line.unit_price), 0);
  const tax = lines.reduce((sum, line) => {
    const draft = drafts[line.id];
    return sum + ((draft?.taxable ?? line.is_taxable) ? Number(draft?.quantity ?? line.fulfilled_quantity) * Number(draft?.unitPrice ?? line.unit_price) * TAX_RATE : 0);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}
