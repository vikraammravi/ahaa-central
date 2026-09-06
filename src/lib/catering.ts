import type { CateringStatus } from "./supabase/types";
import type { StatusKind } from "@/components/ui/status-badge";

export const CATERING_STATUS_LABEL: Record<CateringStatus, string> = {
  INQUIRY: "Inquiry",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const CATERING_STATUS_BADGE: Record<CateringStatus, StatusKind> = {
  INQUIRY: "pending",
  CONFIRMED: "in-stock",
  COMPLETED: "completed",
  CANCELLED: "error",
};

export const CATERING_STATUSES: CateringStatus[] = [
  "INQUIRY",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];
