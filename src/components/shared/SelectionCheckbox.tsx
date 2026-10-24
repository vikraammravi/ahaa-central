import { cn } from "@/lib/utils";

export function SelectionCheckbox({label,checked,disabled=false,onChange}:{
  label:string;checked:boolean;disabled?:boolean;onChange:(checked:boolean)=>void;
}) {
  return <label onClick={event=>event.stopPropagation()} className={cn("inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg touch-manipulation",disabled?"cursor-not-allowed opacity-50":"cursor-pointer hover:bg-accent/40")}>
    <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)} className="size-4 shrink-0 cursor-inherit accent-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"/>
  </label>;
}
