import { StatusBadge } from "@/components/ui/status-badge";

export type PickupReview = { status: string; requested_at: string };

export function PickupApprovalBadge({ requests }: { requests: PickupReview[] }) {
  const latest = requests.reduce<PickupReview | undefined>((current, request) =>
    !current || request.requested_at > current.requested_at ? request : current, undefined);
  if (!latest) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge
    status={latest.status === "APPROVED" ? "completed" : latest.status === "REJECTED" ? "error" : "pending"}
    label={latest.status === "APPROVED" ? "Approved" : latest.status === "REJECTED" ? "Rejected" : "Pending"}
  />;
}
