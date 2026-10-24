import { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

// Native <select> styled to match shadcn inputs. Used inside FormField.
// Prefer this over inline <select className="..."> to keep styling consistent.
export function FormSelect<T extends string = string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  options: readonly SelectOption<T>[] | readonly T[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div className="relative min-w-0 w-full"><select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "h-11 lg:h-10 w-full min-w-0 max-w-full appearance-none truncate rounded-lg border border-input bg-background pl-3 pr-9 text-base lg:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/></div>
  );
}
