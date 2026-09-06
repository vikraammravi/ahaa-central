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

// Happy-path flow shown in the timeline; excludes CANCELLED (side exit).
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "SUBMITTED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

/**
 * The next status the admin should advance to.
 * Admin owns Submitted → Preparing → Ready; branch owns Ready → Completed.
 * Returns null once the order is Ready — waiting on branch pickup.
 */
export function nextAdminStatus(current: OrderStatus): OrderStatus | null {
  if (current === "SUBMITTED") return "PREPARING";
  if (current === "PREPARING") return "READY";
  return null;
}
