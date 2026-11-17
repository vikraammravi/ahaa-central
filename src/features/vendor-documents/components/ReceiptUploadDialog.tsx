"use client";

import { useState } from "react";
import { Spinner } from "@/components/shared/Spinner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/FormSelect";

export function ReceiptUploadDialog({ onUpload }: {
  onUpload: (files: File[], model: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [model, setModel] = useState("prebuilt-invoice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value);
    if (!value) { setFiles([]); setError(""); }
  }
  async function upload() {
    if (!files.length) return;
    if (files.length > 2 || (files.length === 2 && files.some(file => !["image/jpeg", "image/png"].includes(file.type))) || files.some(file => !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) || files.reduce((sum, file) => sum + file.size, 0) > 4000000) { setError("Choose one PDF or up to two JPG or PNG photos under 4 MB total."); return; }
    setBusy(true); setError("");
    try { await onUpload(files, model); setOpen(false); setFiles([]); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to upload invoice."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button><Upload className="size-4" />Upload invoice</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md" showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Upload vendor invoice</DialogTitle><DialogDescription>Upload a supplier invoice or store receipt as a draft. Open it from the list to scan, review and save.</DialogDescription></DialogHeader>
      <div className="min-w-0 space-y-4">
        <label className="block space-y-2 text-sm font-medium">Invoice file<Input className="h-auto min-h-11 min-w-0 py-2 file:mr-2 file:max-w-full" type="file" multiple accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { setFiles(Array.from(e.target.files ?? [])); setError(""); }} /></label>
        <p className="text-xs text-muted-foreground">One PDF or up to two photos (JPG or PNG) · 4 MB total. Photos are scanned in selected order; one scan uses one daily allowance.</p>
        {files.length > 0 && <ol className="list-decimal pl-5 text-sm break-all">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}</ol>}
        <div className="space-y-2"><p className="text-sm font-medium">Document type</p><FormSelect aria-label="Document type" value={model} disabled={busy} onChange={setModel} options={[{ value: "prebuilt-invoice", label: "Supplier invoice" }, { value: "prebuilt-receipt", label: "Miscellaneous" }]} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Cancel</Button><Button disabled={!files.length || busy} onClick={upload}>{busy && <Spinner size="sm" />}{busy ? "Uploading…" : "Upload draft"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
