import type { OrderStatus } from "./supabase/types";
import type { StatusKind } from "@/components/ui/status-badge";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  SUBMITTED: "Submitted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, StatusKind> = {
  SUBMITTED: "pending",
  PREPARING: "low-stock",
  READY: "in-stock",
  COMPLETED: "completed",
  CANCELLED: "error",
};

// Order status flow used by the dispatch board and admin advance-status action
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "SUBMITTED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}
