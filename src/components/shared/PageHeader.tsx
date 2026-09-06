import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            {eyebrow}
          </div>
        )}
        <h1 className="text-forest font-semibold text-2xl sm:text-3xl leading-[1.15] heading-tight mt-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
