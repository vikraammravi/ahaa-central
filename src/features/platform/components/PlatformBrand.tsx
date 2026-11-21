import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_NAME } from "../brand";

/** Platform wordmark. `tone="inverse"` for the dark sidebar. */
export function PlatformBrand({ tone = "default", subtitle, className }: { tone?: "default" | "inverse"; subtitle?: string; className?: string }) {
  return <div className={cn("flex items-center gap-2.5", className)}>
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
      <Layers className="size-4" />
    </span>
    <span className="min-w-0 leading-tight">
      <span className={cn("block truncate text-sm font-semibold tracking-tight", tone === "inverse" ? "text-white" : "text-foreground")}>{PLATFORM_NAME}</span>
      {subtitle && <span className={cn("block truncate text-xs", tone === "inverse" ? "text-slate-400" : "text-muted-foreground")}>{subtitle}</span>}
    </span>
  </div>;
}
