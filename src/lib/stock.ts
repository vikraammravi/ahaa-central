import type { StatusKind } from "@/components/ui/status-badge";

export function stockBadge(available: number, threshold: number): StatusKind {
  if (available <= 0) return "out-of-stock";
  if (available < threshold) return "low-stock";
  return "in-stock";
}
