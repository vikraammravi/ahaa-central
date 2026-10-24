"use client";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog";

export function NotesPreview({text,title,description,preview=true}:{text:string;title:string;description?:string;preview?:boolean}) {
  const descriptionId=useId();
  return <div className="min-w-0 max-w-full md:max-w-64">
    {preview&&<p className="text-xs text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere] line-clamp-2">{text}</p>}
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="mt-1 min-h-9">View Notes</Button></DialogTrigger>
      <DialogContent aria-describedby={description?descriptionId:undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8"><DialogTitle className="break-words">{title}</DialogTitle>{description&&<DialogDescription id={descriptionId}>{description}</DialogDescription>}</DialogHeader>
        <div role="region" aria-label="Full notes" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain whitespace-pre-wrap [overflow-wrap:anywhere] text-sm rounded focus-visible:outline-2 focus-visible:outline-ring">{text}</div>
      </DialogContent>
    </Dialog>
  </div>;
}
