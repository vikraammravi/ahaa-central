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

// Reusable row-actions menu for table rows: Edit + Delete (both optional).
// Additional custom actions can be slotted in via `extra`.
export function RowActions({
  onEdit,
  onDelete,
  deleteTitle = "Delete this item?",
  deleteDescription = "This action cannot be undone.",
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
  deleteTitle?: string;
  deleteDescription?: string;
  extra?: React.ReactNode;
}) {
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
