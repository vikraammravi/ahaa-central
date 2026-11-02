"use client";

import { useState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/FormSelect";

export function ReceiptUploadDialog({ onUpload }: {
  onUpload: (file: File, model: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("prebuilt-invoice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    if (!value) { setFile(null); setError(""); }
  }
  async function upload() {
    if (!file) return;
    setBusy(true); setError("");
    try { await onUpload(file, model); setOpen(false); setFile(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to upload invoice."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button><Upload className="size-4" />Upload invoice</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Upload vendor invoice</DialogTitle><DialogDescription>Upload a supplier invoice or store receipt as a draft. Open it from the list to scan, review and save.</DialogDescription></DialogHeader>
      <div className="min-w-0 space-y-4">
        <label className="block space-y-2 text-sm font-medium">Invoice file<Input className="h-auto min-h-11 min-w-0 py-2 file:mr-2 file:max-w-full" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }} /></label>
        <p className="text-xs text-muted-foreground">PDF, JPG or PNG · Maximum 4 MB.</p>
        <div className="space-y-2"><p className="text-sm font-medium">Document type</p><FormSelect aria-label="Document type" value={model} disabled={busy} onChange={setModel} options={[{ value: "prebuilt-invoice", label: "Supplier invoice" }, { value: "prebuilt-receipt", label: "Miscellaneous" }]} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={!file || busy} onClick={upload}>{busy && <Spinner size="sm" />}{busy ? "Uploading…" : "Upload draft"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
