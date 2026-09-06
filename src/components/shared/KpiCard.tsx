import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Kpi = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "success";
};

const toneMap = {
  default: "text-forest",
  warn: "text-[#C87F13]",
  danger: "text-[#C1272D]",
  success: "text-[#15803D]",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: Kpi & { icon?: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </div>
          {icon}
        </div>
        <div
          className={cn(
            "font-semibold text-2xl sm:text-3xl leading-none mt-3 tabular heading-tight",
            toneMap[tone],
          )}
        >
          {value}
        </div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-2">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((k) => (
        <KpiCard key={k.label} {...k} />
      ))}
    </section>
  );
}
