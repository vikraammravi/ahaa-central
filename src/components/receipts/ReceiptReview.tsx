"use client";
import { useState } from "react";
import { ArrowLeft, Pencil, Eye, RefreshCw, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/shared/Spinner";
import { Input } from "@/components/ui/input";
import { SelectionCheckbox } from "@/components/shared/SelectionCheckbox";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { expenseCategories, receiptWarnings, type PurchaseReceipt, type ReceiptDetails } from "@/lib/receipts";

export function ReceiptReview({ receipt, busy, onSave, onScan, onClose }: {
  receipt: PurchaseReceipt; busy: boolean;
  onSave: (details: ReceiptDetails, category: string) => Promise<void>;
  onScan: () => Promise<void>; onClose: () => void;
}) {
  const [details, setDetails] = useState(receipt.details);
  const [category, setCategory] = useState(receipt.category);
  const [editing, setEditing] = useState(receipt.status !== "SAVED");
  const readOnly = receipt.status === "SAVED" && !editing;
  const [reviewed, setReviewed] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dirty = JSON.stringify(details) !== JSON.stringify(receipt.details) || category !== receipt.category;
  const canLeave = useUnsavedChanges(dirty, "Leave and discard your unsaved receipt changes?", busy);
  const warnings = receiptWarnings(details);
  const set = (field: keyof ReceiptDetails, value: string | number | null) => { setReviewed(false); setDetails(d => ({ ...d, [field]: value })); };
  const original = `/api/receipts/${receipt.id}?original=1`;
  const locked = busy || receipt.scan_status === "RUNNING";
  return <section className="space-y-4 rounded-xl border bg-surface p-4 sm:p-5">
    <Button variant="ghost" className="-ml-2" disabled={locked} onClick={async () => { if (await canLeave()) onClose(); }}><ArrowLeft className="size-4" />Back to receipts</Button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-lg">Review receipt</h2><p className="text-sm text-muted-foreground break-all">{receipt.file_name} · {receipt.status === "SAVED" ? "Completed" : "Draft"}</p></div><div className="flex flex-wrap gap-2">
      {receipt.status === "SAVED" && <Button variant="outline" disabled={locked} onClick={async () => {
        if (editing) {
          if (!await canLeave()) return;
          setDetails(receipt.details); setCategory(receipt.category); setReviewed(false); setSaveError("");
        }
        setEditing(value => !value);
      }}><Pencil className="size-4" />{editing ? "Cancel edit" : "Edit"}</Button>}
      <Button asChild variant="outline"><a href={original} target="_blank" rel="noopener noreferrer"><Eye className="size-4" />View original</a></Button>
      {!readOnly && <ConfirmDialog tone="default" title="Scan the original receipt?" description="This uses one scan from your daily allowance and replaces the current form with extracted details. Review the amounts before saving." confirmLabel="Scan receipt" onConfirm={onScan} trigger={<Button disabled={locked}><RefreshCw className="size-4" />{receipt.scan_status === "NOT_SCANNED" ? "Scan with AI" : "Rescan"}</Button>} />}
    </div></div>
    <div className="min-w-0">
      <div className="space-y-4 min-w-0">
        {receipt.scan_status === "RUNNING" && <div role="status" className="flex items-center gap-2 rounded-lg border p-3 text-sm"><Spinner size="sm" />Scanning invoice… Details will appear when ready. You can return later.</div>}
        {receipt.scan_status === "FAILED" && <p role="alert" className="text-sm text-destructive">Scanning failed. Try again or enter the details manually.</p>}
        {readOnly && <p className="text-sm text-muted-foreground">Completed invoice. Select Edit to make changes or rescan the original.</p>}
        <fieldset disabled={locked || readOnly} className={`space-y-4 ${readOnly ? "[&_input:disabled]:opacity-100 [&_select:disabled]:opacity-100" : "disabled:opacity-60"}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vendor" htmlFor="receipt-vendor" required><Input id="receipt-vendor" value={details.vendor} maxLength={300} onChange={e => set("vendor", e.target.value)} /></FormField>
            <FormField label="Invoice / receipt number" htmlFor="receipt-number"><Input id="receipt-number" value={details.invoiceNumber} maxLength={300} onChange={e => set("invoiceNumber", e.target.value)} /></FormField>
            <FormField label="Date" htmlFor="receipt-date" required><Input id="receipt-date" type="date" value={details.date} onChange={e => set("date", e.target.value)} /></FormField>
            <FormField label="Category" htmlFor="receipt-category"><FormSelect id="receipt-category" options={expenseCategories} value={category} onChange={v => { setCategory(v); setReviewed(false); }} /></FormField>
          </div>
          <div className="flex items-center justify-between gap-2"><h3 className="font-medium">Items ({details.items.length})</h3>{!readOnly && <Button type="button" size="sm" variant="outline" disabled={details.items.length >= 300} onClick={() => { setReviewed(false); setDetails(d => ({ ...d, items: [...d.items, { description: "", quantity: null, unitPrice: null, amount: null }] })); }}><Plus className="size-4" />Add item</Button>}</div>
          <div className="space-y-3">{details.items.map((item, index) => <div className="rounded-lg border p-3 space-y-3" key={index}>
            <div className="flex items-end gap-2"><FormField label={`Item ${index + 1}`} htmlFor={`item-${index}`} className="flex-1"><Input id={`item-${index}`} value={item.description} maxLength={1000} onChange={e => { setReviewed(false); setDetails(d => ({ ...d, items: d.items.map((v, i) => i === index ? { ...v, description: e.target.value } : v) })); }} /></FormField>{!readOnly && <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} onClick={() => { setReviewed(false); setDetails(d => ({ ...d, items: d.items.filter((_, i) => i !== index) })); }}><Trash2 className="size-4" /></Button>}</div>
            <div className="grid grid-cols-3 gap-2">{(["quantity", "unitPrice", "amount"] as const).map(field => <FormField key={field} label={field === "quantity" ? "Quantity" : field === "unitPrice" ? "Unit price" : "Amount"} htmlFor={`${field}-${index}`}><Input id={`${field}-${index}`} type="number" step="any" value={item[field] ?? ""} onChange={e => { setReviewed(false); const value = e.target.value === "" ? null : Number(e.target.value); setDetails(d => ({ ...d, items: d.items.map((v, i) => i === index ? { ...v, [field]: value } : v) })); }} /></FormField>)}</div>
          </div>)}</div>
          <div className="grid grid-cols-3 gap-2">{(["subtotal", "tax", "total"] as const).map(field => <FormField label={field === "tax" ? "Tax amount" : field === "total" ? "Total" : "Subtotal"} htmlFor={`receipt-${field}`} key={field}><Input id={`receipt-${field}`} type="number" step="0.01" value={details[field] ?? ""} onChange={e => set(field, e.target.value === "" ? null : Number(e.target.value))} /></FormField>)}</div>
          {!readOnly && <>
          {!!warnings.length && <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-300">{warnings.map(w => <li key={w}>{w}</li>)}</ul>}
          <div className="flex items-center gap-2 text-sm"><SelectionCheckbox label="I reviewed the original receipt" checked={reviewed} disabled={locked} onChange={setReviewed} /><span>I checked the original receipt and reviewed the details and amounts.</span></div>
          {!reviewed && <p className="text-sm text-muted-foreground">Select “I reviewed the original receipt” above to enable saving.</p>}
          {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
          <Button disabled={!reviewed || warnings.some(w => w.startsWith("Enter"))} onClick={async () => {
            setSaveError("");
            try { await onSave(details, category); }
            catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save invoice. Try again."); }
          }}>{busy ? "Saving…" : "Save reviewed receipt"}</Button>
          </>}
        </fieldset>
      </div>
    </div>
  </section>;
}
