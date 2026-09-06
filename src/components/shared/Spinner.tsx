import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeMap = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const;

export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
  label?: string;
}) {
  return (
    <Loader2
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
    />
  );
}

// Full-block loading state — centered spinner with optional caption.
export function LoadingState({
  label = "Loading…",
  className,
  minHeight = "min-h-40",
}: {
  label?: string;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground",
        minHeight,
        className,
      )}
    >
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}
