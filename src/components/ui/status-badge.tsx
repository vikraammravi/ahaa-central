import { cn } from "@/lib/utils";

export type StatusKind =
  | "in-stock"
  | "low-stock"
  | "out-of-stock"
  | "pending"
  | "completed"
  | "paid"
  | "overdue"
  | "error"
  | "active"
  | "inactive";

const styles: Record<StatusKind, { cls: string; label: string }> = {
  "in-stock": { cls: "bg-[#DCFCE7] text-[#16A34A]", label: "In Stock" },
  "low-stock": { cls: "bg-[#FEF3C7] text-[#D97706]", label: "Low Stock" },
  "out-of-stock": { cls: "bg-[#FEE2E2] text-[#DC2626]", label: "Out of Stock" },
  pending: { cls: "bg-[#FEF3C7] text-[#D97706]", label: "Pending" },
  completed: { cls: "bg-[#DCFCE7] text-[#15803D]", label: "Completed" },
  paid: { cls: "bg-[#DCFCE7] text-[#15803D]", label: "Paid" },
  overdue: { cls: "bg-[#FEE2E2] text-[#DC2626]", label: "Overdue" },
  error: { cls: "bg-[#FEE2E2] text-[#DC2626]", label: "Error" },
  active: { cls: "bg-[#DCFCE7] text-[#15803D]", label: "Active" },
  inactive: { cls: "bg-[#F3F4F6] text-[#66736E]", label: "Inactive" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusKind;
  label?: string;
  className?: string;
}) {
  const s = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        s.cls,
        className,
      )}
    >
      {label ?? s.label}
    </span>
  );
}
