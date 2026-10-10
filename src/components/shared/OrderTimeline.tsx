import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { OrderStatus } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/format";

export function OrderTimeline({ status, updatedAt }: { status: OrderStatus; updatedAt: string }) {
  const current = ORDER_STATUS_FLOW.indexOf(status);
  return <ol className="space-y-2">{ORDER_STATUS_FLOW.map((step, index) => {
    const active = step === status;
    const reached = index <= current;
    return <li key={step} className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-saffron" : reached ? "bg-[#16A34A]" : "bg-border"}`} />
      <span className={reached ? "text-foreground" : "text-muted-foreground"}>{ORDER_STATUS_LABEL[step]}</span>
      {active && <span className="text-[11px] text-muted-foreground ml-auto">{formatDateTime(updatedAt)}</span>}
    </li>;
  })}</ol>;
}
