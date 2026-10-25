"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";

export function RowActions({onEdit,onDelete,extraActions,deleteTitle="Delete this item?",deleteDescription="This action cannot be undone."}:{
  onEdit?:()=>void;
  onDelete?:()=>Promise<void>|void;
  extraActions?:ReactNode;
  deleteTitle?:string;
  deleteDescription?:string;
}) {
  return <div className="inline-flex items-center gap-1" onClick={event=>event.stopPropagation()}>
    {onEdit&&<Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label="Edit" title="Edit" onClick={onEdit}><Pencil className="size-4"/></Button>}
    {extraActions}
    {onDelete&&<ConfirmDialog trigger={<Button variant="outline" size="icon" className="size-11 lg:size-9 text-destructive" aria-label="Delete" title="Delete"><Trash2 className="size-4"/></Button>} title={deleteTitle} description={deleteDescription} confirmLabel="Delete" onConfirm={onDelete}/>}
  </div>;
}
