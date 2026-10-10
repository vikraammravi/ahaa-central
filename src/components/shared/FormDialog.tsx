"use client";

import { FormEvent, ReactNode, useState } from "react";
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

// Reusable form-in-a-dialog wrapper.
// Uncontrolled: pass a `trigger`.
// Controlled: pass `open` + `onOpenChange` (trigger becomes optional).
export function FormDialog({
  trigger,
  title,
  description,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onSubmit,
  children,
  size = "md",
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => Promise<void> | void;
  children: ReactNode;
  size?: "md" | "lg";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setUncontrolledOpen(v);
  };

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={actualOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-4">{children}</div>
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
            <Button type="submit" disabled={busy}>
              {busy && <Spinner size="xs" className="text-primary-foreground" />}
              {busy ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
