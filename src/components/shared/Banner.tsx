import { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "warn" | "danger";

const toneStyles: Record<Tone, { wrap: string; icon: typeof CheckCircle2 }> = {
  success: {
    wrap: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
    icon: CheckCircle2,
  },
  info: {
    wrap: "bg-accent text-accent-foreground border-[#FDE68A]",
    icon: Info,
  },
  warn: {
    wrap: "bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]",
    icon: AlertTriangle,
  },
  danger: {
    wrap: "bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]",
    icon: XCircle,
  },
};

export function Banner({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = toneStyles[tone];
  const Icon = t.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border rounded-lg px-3 py-2 text-sm",
        t.wrap,
        className,
      )}
    >
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
