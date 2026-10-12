import type { WeeklyInvoiceDetails } from "./supabase/types";

export type InvoiceSummarySource = {
  sent_revision: number | null;
  orders?: { id: string; order_number: number; order_date: string; final_total_amount: number }[];
  weekly_invoice_publications?: { revision: number; snapshot: WeeklyInvoiceDetails }[];
};

// Branch lists must use published values, even when admin has unsent corrections.
export function invoiceSummaryOrders(invoice: InvoiceSummarySource, isAdmin: boolean): WeeklyInvoiceDetails["orders"] {
  if (isAdmin) return (invoice.orders ?? []).map(order => ({
    id: order.id, order_number: order.order_number, order_date: order.order_date, total: order.final_total_amount,
  }));
  return invoice.weekly_invoice_publications?.find(publication => publication.revision === invoice.sent_revision)?.snapshot.orders ?? [];
}
