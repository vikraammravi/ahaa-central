import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = "full" | "compact" | "mark";
type Size = "sm" | "md" | "lg" | "xl";

// Displayed height in px per size — width scales via the image's aspect ratio.
const fullHeight: Record<Size, number> = {
  sm: 32,
  md: 44,
  lg: 60,
  xl: 84,
};

const markSize: Record<Size, string> = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
  xl: "w-14 h-14 text-lg",
};

export function Logo({
  variant = "full",
  size = "md",
  href = "/",
  className,
  priority,
}: {
  variant?: Variant;
  size?: Size;
  href?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-forest text-white font-bold shrink-0",
        markSize[size],
      )}
    >
      A
    </span>
  );

  const content =
    variant === "mark" ? (
      mark
    ) : variant === "compact" ? (
      <span className="inline-flex items-center gap-2.5">
        {mark}
        <span className="flex flex-col leading-none">
          <span className="text-[13px] font-semibold text-forest tracking-tight">
            Aaha Central
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            Kitchen Operations
          </span>
        </span>
      </span>
    ) : (
      <Image
        src="/aaha-logo.png"
        alt="Aaha — Truly South"
        width={fullHeight[size] * 3}
        height={fullHeight[size]}
        priority={priority}
        style={{ height: fullHeight[size], width: "auto" }}
      />
    );

  if (href === null) {
    return (
      <span
        className={cn("inline-flex", className)}
        aria-label="Aaha Central"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex", className)}
      aria-label="Aaha Central"
    >
      {content}
    </Link>
  );
}
