"use client";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, SlidersHorizontal } from "lucide-react";

// Min-width constraints keep date inputs and long option labels inside each column.
export function FilterBar({columns=2,className,children,...props}:ComponentProps<"div">&{columns?:2|3|4}) {
  const compact=useCompactLayout();
  const [open,setOpen]=useState(false);
  const fields=<div className={cn(
    "grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 [&>div]:min-w-0 [&_input]:h-11 [&_input]:max-w-full [&_input]:text-base [&_select]:h-11 [&_select]:text-base [&>button]:h-11 lg:[&_input]:h-10 lg:[&_input]:text-sm lg:[&_select]:h-10 lg:[&_select]:text-sm lg:[&>button]:h-10",
    columns===3&&"xl:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,200px)]",
    columns===4&&"xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
    !compact&&className,
  )}>{children}</div>;
  if(!compact)return <div {...props}>{fields}</div>;
  return <div {...props} className="sticky top-14 z-20 min-w-0 max-w-full bg-background/95 py-2 backdrop-blur-sm">
    <Button variant="outline" className="h-11 w-full justify-between" onClick={()=>setOpen(true)}><span className="flex items-center gap-2"><Search className="size-4"/>Search &amp; filters</span><SlidersHorizontal className="size-4"/></Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="mx-auto w-full min-w-0 max-h-[85dvh] max-w-2xl overflow-hidden rounded-t-2xl" aria-describedby={undefined}>
      <SheetHeader><SheetTitle>Search &amp; filters</SheetTitle><SheetDescription>Changes apply as you update the fields.</SheetDescription></SheetHeader>
      <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-4 pb-2">{fields}</div>
      <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button className="h-11 w-full" onClick={()=>setOpen(false)}>Show results</Button></div>
    </SheetContent></Sheet>
  </div>;
}
