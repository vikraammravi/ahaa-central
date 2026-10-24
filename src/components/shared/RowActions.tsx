"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { CardActions } from "./CardActions";

// Reusable row-actions menu for table rows: Edit + Delete (both optional).
// Additional custom actions can be slotted in via `extra`.
export function RowActions({
  onEdit,
  onDelete,
  deleteTitle = "Delete this item?",
  deleteDescription = "This action cannot be undone.",
  extra,
  compactExtra,
  iconsOnly=false,
}: {
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
  deleteTitle?: string;
  deleteDescription?: string;
  extra?: React.ReactNode;
  compactExtra?:React.ReactNode;
  iconsOnly?:boolean;
}) {
  const compact=useCompactLayout();
  if(iconsOnly)return <div className="inline-flex items-center gap-1">
    {onEdit&&<Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label="Edit" onClick={onEdit}><Pencil className="size-4"/></Button>}
    {onDelete&&<ConfirmDialog trigger={<Button variant="outline" size="icon" className="size-11 lg:size-9 text-destructive" aria-label="Delete"><Trash2 className="size-4"/></Button>} title={deleteTitle} description={deleteDescription} confirmLabel="Delete" onConfirm={onDelete}/>}
  </div>;
  if(compact)return <CardActions>
    {onEdit&&<Button variant="outline" className="h-11" onClick={onEdit}><Pencil className="size-4"/>Edit</Button>}
    {compactExtra}
    {onDelete&&<ConfirmDialog trigger={<Button variant="outline" className="h-11 text-destructive"><Trash2 className="size-4"/>Delete</Button>} title={deleteTitle} description={deleteDescription} confirmLabel="Delete" onConfirm={onDelete}/>}
  </CardActions>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Row actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-3.5" /> Edit
          </DropdownMenuItem>
        )}
        {extra}
        {onDelete && (
          <>
            {onEdit && <DropdownMenuSeparator />}
            <ConfirmDialog
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  variant="destructive"
                >
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              }
              title={deleteTitle}
              description={deleteDescription}
              confirmLabel="Delete"
              onConfirm={onDelete}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
