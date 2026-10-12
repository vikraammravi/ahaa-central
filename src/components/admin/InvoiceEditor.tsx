"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { invoiceDraftError, invoiceDraftTotals, type InvoiceEditLine, type InvoiceLineDraft } from "@/lib/invoices";
import type { Order } from "@/lib/supabase/types";

export function InvoiceEditor({ order, lines, onSaved, onCancel }: {
  order: Order;
  lines: InvoiceEditLine[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, InvoiceLineDraft>>(() => Object.fromEntries(lines.map((line) => [line.id, {
    quantity: String(line.fulfilled_quantity), unitPrice: Number(line.unit_price).toFixed(2), taxable: line.is_taxable,
  }])));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = invoiceDraftError(lines, drafts);
  const totals = invoiceDraftTotals(lines, drafts);
  const dirty = lines.some((line) => Number(drafts[line.id]?.quantity) !== line.fulfilled_quantity || Number(drafts[line.id]?.unitPrice) !== Number(line.unit_price) || drafts[line.id]?.taxable !== line.is_taxable);
  const patch = (id: string, values: Partial<InvoiceLineDraft>) => setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...values } }));
  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (validation) throw new Error(validation);
      const { error } = await supabase.rpc("edit_invoice", {
        p_order_id: order.id, p_reason: reason, p_expected_updated_at: order.updated_at,
        p_lines: lines.map((line) => ({ line_id: line.id, quantity: Number(drafts[line.id].quantity), unit_price: Number(drafts[line.id].unitPrice), is_taxable: drafts[line.id].taxable, return_to_stock: drafts[line.id].returnToStock })),
      });
      if (error) throw new Error(error.message);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update invoice.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="space-y-4">
    {order.weekly_invoice_id && <Banner tone="info">The branch keeps the last sent invoice until you send this update.</Banner>}
    <Banner tone="info">These changes affect billing only. Unit prices are locked. Use pickup approval and return receipt to adjust physical quantities or stock.</Banner>
    <div className="space-y-3">{lines.map((line) => {
      const draft = drafts[line.id];
      return <div key={line.id} className="rounded-xl border p-3 space-y-3">
        <p className="font-medium">{line.catalog_items?.name ?? "Item"}<span className="ml-2 text-xs font-normal text-muted-foreground">{line.catalog_items?.unit_type}</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label htmlFor={`invoice-qty-${line.id}`}>Billed Quantity</Label><Input id={`invoice-qty-${line.id}`} type="number" min={0} max={2147483647} step={1} value={draft.quantity} disabled={busy} onChange={(event) => patch(line.id, { quantity: event.target.value })} /><p className="text-xs text-muted-foreground">Original request: {line.quantity}</p></div>
          <div className="space-y-1.5"><Label>Unit Price (locked)</Label><p className="h-9 flex items-center text-sm">CA${Number(line.unit_price).toFixed(2)}</p></div>
          <div className="space-y-1.5"><Label htmlFor={`invoice-tax-${line.id}`}>Tax</Label><select id={`invoice-tax-${line.id}`} value={String(draft.taxable)} disabled={busy} onChange={(event) => patch(line.id, { taxable: event.target.value === "true" })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="true">13%</option><option value="false">-</option></select></div>
        </div>
      </div>;
    })}</div>
    <div className="space-y-1.5"><Label htmlFor="invoice-edit-reason">Note (optional)</Label><Input id="invoice-edit-reason" value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Invoice correction note" /></div>
    <div className="text-sm space-y-1 rounded-lg bg-muted p-3"><p>Subtotal: CA${Number.isFinite(totals.subtotal) ? totals.subtotal.toFixed(2) : "—"}</p><p>Tax: CA${Number.isFinite(totals.tax) ? totals.tax.toFixed(2) : "—"}</p><p className="font-semibold">Updated total: CA${Number.isFinite(totals.total) ? totals.total.toFixed(2) : "—"}</p></div>
    {validation && <p className="text-sm text-destructive">{validation}</p>}
    {error && <Banner tone="danger">{error}</Banner>}
    <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={busy || !dirty || !!validation}>{busy ? "Saving…" : "Save Invoice Changes"}</Button><Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button></div>
  </div>;
}
