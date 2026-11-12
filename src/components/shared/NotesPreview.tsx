"use client";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function NotesPreview({text,title,description,preview=true,buttonClassName,buttonLabel="View Notes",contentLabel="Full notes",details=[]}:{text:string;title:string;description?:string;preview?:boolean;buttonClassName?:string;buttonLabel?:string;contentLabel?:string;details?:{label:string;value:string}[]}) {
  const descriptionId=useId();
  return <div className="min-w-0 max-w-full md:max-w-64">
    {preview&&<p className="text-xs text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere] line-clamp-2">{text}</p>}
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm" className={cn("mt-1 min-h-9",buttonClassName)}>{buttonLabel}</Button></DialogTrigger>
      <DialogContent aria-describedby={description?descriptionId:undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8"><DialogTitle className="break-words">{title}</DialogTitle>{description&&<DialogDescription id={descriptionId}>{description}</DialogDescription>}</DialogHeader>
        <div role="region" aria-label="Details" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain space-y-4 text-sm rounded focus-visible:outline-2 focus-visible:outline-ring">
          {text && <div role="region" aria-label={contentLabel} tabIndex={0} className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded focus-visible:outline-2 focus-visible:outline-ring">{text}</div>}
          {details.map(detail=><section key={detail.label} className="space-y-1"><h3 className="font-semibold">{detail.label}</h3><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{detail.value}</p></section>)}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
