"use client";

import { ReactNode, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "./Spinner";

// Reusable "are you sure?" dialog. Wrap any trigger; supply an onConfirm.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  open:controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  onConfirm: () => Promise<void> | void;
  open?:boolean;
  onOpenChange?:(open:boolean)=>void;
}) {
  const [internalOpen,setInternalOpen]=useState(false);
  const descriptionId=useId();
  const open=controlledOpen??internalOpen;
  function setOpen(value:boolean){if(controlledOpen===undefined)setInternalOpen(value);onOpenChange?.(value);}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to complete this action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
      {trigger&&<DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent aria-describedby={description?descriptionId:undefined} showCloseButton={!busy} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy && <Spinner size="xs" />}
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
