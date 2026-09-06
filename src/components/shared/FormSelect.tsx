import { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm",
        className,
      )}
      {...rest}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
