"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Banner } from "@/components/shared/Banner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { LoadingState, Spinner } from "@/components/shared/Spinner";
import { InvoiceTotals } from "./InvoiceTotals";
import { fetchCombinedInvoicePreview, type CombinedInvoicePreview, type CombinedInvoicePreviewOrder } from "../data";
import type { InvoiceFilters } from "../combined";
import { useAsyncData } from "@/lib/useAsyncData";
import { formatDate, formatMoney } from "@/lib/format";

export function CombineInvoicePreviewDialog({ filters, orderIds, branchName, onClose, onCombine }: {
  filters: InvoiceFilters;
  orderIds: string[];
  branchName: string;
  onClose: () => void;
  onCombine: (preview: CombinedInvoicePreview) => Promise<void>;
}) {
  const load = useCallback((signal: AbortSignal) => fetchCombinedInvoicePreview(filters, orderIds, signal), [filters, orderIds]);
  const preview = useAsyncData(load, { refreshOnFocus: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    if (!preview.data || preview.loading || busy) return;
    setBusy(true); setError(null);
    try {
      // Recheck all selected pages before writing. The atomic database function
      // remains authoritative for eligibility and concurrent combinations.
      const latest = await fetchCombinedInvoicePreview(filters, orderIds);
      if (JSON.stringify(latest) !== JSON.stringify(preview.data)) {
        preview.mutate(() => latest);
        setError("These invoices changed. Review the updated amounts below, then confirm again.");
        return;
      }
      await onCombine(preview.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to combine invoices.");
    } finally { setBusy(false); }
  }
  const columns: Column<CombinedInvoicePreviewOrder>[] = [
    { key: "number", header: "Invoice", render: order => <span className="font-medium">INV-{order.order_number}</span> },
    { key: "date", header: "Date", render: order => formatDate(order.order_date) },
    { key: "total", header: "Total", align: "right", render: order => formatMoney(order.final_total_amount) },
  ];
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={!busy} className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl">
      <DialogHeader><DialogTitle>Review combined invoice</DialogTitle><DialogDescription>Check the selected orders and total before combining. The invoice will be created without sending it to the branch.</DialogDescription></DialogHeader>
      <p className="break-words font-medium">{branchName}</p>
      {preview.loading ? <LoadingState label="Loading selected invoices…" /> : preview.error ? <Banner tone="danger">{preview.error}</Banner> : preview.data && <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{preview.data.orders.length} {preview.data.orders.length === 1 ? "order" : "orders"} selected</span><span>{formatDate(preview.data.startDate)} – {formatDate(preview.data.endDate)}</span></div>
        <DataTable data={preview.data.orders} columns={columns} rowKey={order => order.id} renderCard={order => <div className="space-y-1 text-sm"><div className="flex items-start justify-between gap-3"><span className="font-medium">INV-{order.order_number}</span><span className="tabular-nums">{formatMoney(order.final_total_amount)}</span></div><p className="text-muted-foreground">{formatDate(order.order_date)}</p></div>} />
        <InvoiceTotals subtotal={preview.data.subtotal} tax={preview.data.tax} total={preview.data.total} />
      </div>}
      {error && <Banner tone="danger">{error}</Banner>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>{preview.error ? <Button onClick={() => { setError(null); void preview.refresh(); }}>Retry preview</Button> : <Button disabled={busy || preview.loading || !preview.data} onClick={confirm}>{busy && <Spinner size="xs" />}{busy ? "Combining…" : "Confirm & Combine"}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}
