"use client";

import { LoadingState, Spinner } from "@/components/shared/Spinner";
import { Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/shared/RowActions";
import { formatDate, formatMoney } from "@/lib/format";
import type { PurchaseReceipt } from "@/features/vendor-documents/domain";

export function ReceiptList({ rows, loading, busy, onEdit, onDelete }: {
  rows: PurchaseReceipt[]; loading: boolean; busy: boolean;
  onEdit: (receipt: PurchaseReceipt) => void;
  onDelete: (receipt: PurchaseReceipt) => Promise<void>;
}) {
  const columns: Column<PurchaseReceipt>[] = [
    { key: "vendor", className: "w-[22%] whitespace-normal break-words", header: "Vendor", render: row => <span className="font-medium">{row.details.vendor || "Not entered"}</span> },
    { key: "number", className: "w-[17%] whitespace-normal break-words", header: "Invoice #", render: row => row.details.invoiceNumber || "N/A" },
    { key: "date", className: "w-[11%] whitespace-normal break-words", header: "Date", render: row => formatDate(row.details.date || row.created_at) },
    { key: "category", className: "w-[11%] whitespace-normal break-words", header: "Category", render: row => row.category },
    { key: "total", className: "w-[12%] whitespace-nowrap", header: "Total", render: row => row.details.total === null ? "N/A" : row.details.currency === "CAD" ? formatMoney(row.details.total) : `${row.details.currency} ${row.details.total.toFixed(2)}` },
    { key: "status", className: "w-[9%] whitespace-normal break-words", header: "Status", render: row => <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${row.status === "SAVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{row.status === "SAVED" ? "Completed" : "Draft"}</span> },
    { key: "actions", className: "w-[18%] whitespace-normal break-words", header: "Actions", cardSpan: 2, render: row => <fieldset disabled={busy} className="min-w-0"><RowActions extraActions={<Button asChild variant="outline" size="icon" className="size-11 lg:size-9" title="View invoice"><a href={`/api/receipts/${row.id}?original=1`} target="_blank" rel="noopener noreferrer" aria-label="View invoice"><Eye className="size-4" /></a></Button>} onEdit={() => onEdit(row)} onDelete={row.scan_status === "RUNNING" ? undefined : () => onDelete(row)} deleteTitle="Delete vendor invoice?" deleteDescription="Remove this invoice from the list. Its original and scan-usage history will be retained." /></fieldset> },
  ];
  return <section aria-label="Vendor invoice list" aria-busy={loading} className="min-w-0 space-y-3">
    {loading && (rows.length ? <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size="sm" />Updating invoices…</div> : <div role="status" className="rounded-2xl border bg-surface"><LoadingState label="Loading invoices…" minHeight="min-h-64" /></div>)}
    {(rows.length > 0 || !loading) && <DataTable tableClassName="w-full table-fixed" data={rows} columns={columns} loading={false} rowKey={row => row.id} emptyTitle="No vendor invoices found" emptyBody="Try changing your search or filters, or upload a new invoice." />}
  </section>;
}
