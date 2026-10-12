import type { Order } from "./supabase/types";
export type InvoiceFilters = { startDate: string; endDate: string; branchId: string };
export function eligibleForWeekly(order: Pick<Order, "status" | "weekly_invoice_id" | "pickup_approval_status"> & { pickup_requests?: { return_status: string | null }[] }): boolean {
  return order.status === "COMPLETED" && !order.weekly_invoice_id && order.pickup_approval_status !== "PENDING" && !order.pickup_requests?.some((request) => request.return_status === "PENDING");
}
export function weeklyNumber(id: string): string { return `WK-${id.slice(0,8).toUpperCase()}`; }
