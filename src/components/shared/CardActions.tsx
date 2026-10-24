import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CardActions({className,...props}:ComponentProps<"div">) {
  return <div {...props} className={cn("grid w-full min-w-0 grid-cols-2 items-stretch gap-2 [&>*]:min-w-0 [&_button]:min-h-11 [&_button]:h-auto [&_button]:w-full [&_button]:px-2 [&_button]:whitespace-normal [&_a]:min-h-11 [&_a]:w-full [&_a]:px-2 [&_a]:whitespace-normal",className)}/>;
}
