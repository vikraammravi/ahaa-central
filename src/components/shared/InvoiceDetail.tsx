"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./Spinner";
import { DataTable, type Column } from "./DataTable";
import { SendInvoiceButton } from "@/components/admin/SendInvoiceButton";
import { InvoiceEditor } from "@/components/admin/InvoiceEditor";
import { Button } from "@/components/ui/button";
import { InvoiceHistory } from "@/components/admin/InvoiceHistory";
import { InvoiceTotals } from "./InvoiceTotals";
import { formatMoney as money, taxLabel, formatDate, formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { invoiceDateKey, invoiceNeedsSending } from "@/lib/invoices";
import type { Order, OrderLine, Location, InvoiceEdit } from "@/lib/supabase/types";

type InvoiceOrder = Order & { locations: Pick<Location, "name" | "address" | "city" | "province"> | null };
type InvoiceLine = OrderLine & { catalog_items: { name: string; unit_type: string } | null };

export function InvoiceDetail({ orderId, isAdmin = false }: { orderId: string; isAdmin?: boolean }) {
  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<InvoiceEdit[]>([]);
  const load = useCallback(async () => {
    let invoiceQuery = supabase.from("orders").select("*, locations(name, address, city, province)").eq("id", orderId);
    if (!isAdmin) invoiceQuery = invoiceQuery.not("invoice_sent_at", "is", null).eq("status", "COMPLETED");
    const [{ data: invoice, error: invoiceError }, { data: rows, error: lineError }, audit] = await Promise.all([
      invoiceQuery.single(),
      supabase.from("order_lines").select("*, catalog_items(name, unit_type)").eq("order_id", orderId).order("id"),
      isAdmin ? supabase.from("invoice_edits").select("*, edited_profile:profiles!invoice_edits_edited_by_fkey(full_name)").eq("order_id", orderId).order("revision", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (invoiceError || lineError || audit.error) { setError(invoiceError?.message ?? lineError?.message ?? audit.error?.message ?? "Unable to load invoice."); setOrder(null); }
    else {
      const loaded = invoice as InvoiceOrder;
      setOrder(loaded);
      setLines(!isAdmin && loaded.invoice_published_lines ? loaded.invoice_published_lines : (rows as InvoiceLine[]) ?? []);
      setHistory((audit.data as InvoiceEdit[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, [orderId, isAdmin]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (loading) return <LoadingState label="Loading invoice…" />;
  if (!order) return <div className="space-y-3">{error && <Banner tone="danger">{error}</Banner>}<EmptyState title="Invoice unavailable" body={isAdmin ? "This order could not be loaded." : "The final invoice becomes available when central admin sends it."} /></div>;
  const needsSending = invoiceNeedsSending(order);
  const canEdit = isAdmin && order.status !== "CANCELLED" && order.pickup_approval_status !== "PENDING";
  const subtotal = !isAdmin ? order.invoice_published_subtotal ?? order.final_subtotal : order.final_subtotal;
  const tax = !isAdmin ? order.invoice_published_tax ?? order.final_tax_amount : order.final_tax_amount;
  const total = !isAdmin ? order.invoice_published_total ?? order.final_total_amount : order.final_total_amount;
  const columns: Column<InvoiceLine>[] = [
    { key: "item", header: "Item", className: "whitespace-normal min-w-32", render: (line) => <div className="font-medium">{line.catalog_items?.name ?? "Item"}<div className="text-xs font-normal text-muted-foreground">{line.catalog_items?.unit_type}</div></div> },
    { key: "qty", header: "Billed Qty", align: "right", render: (line) => line.fulfilled_quantity },
    { key: "price", header: "Unit Price", align: "right", render: (line) => money(line.unit_price) },
    { key: "tax", header: "Tax", hideOn: "sm", render: (line) => taxLabel(line.is_taxable) },
    { key: "total", header: "Subtotal", align: "right", render: (line) => money(line.final_line_total) },
  ];
  return <div className="space-y-4">
    {error && <Banner tone="danger">{error}</Banner>}
    <Card><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><CardTitle className="text-xl">Invoice INV-{order.order_number}</CardTitle><p className="text-sm text-muted-foreground mt-1">{formatDate(invoiceDateKey(order))} · Order #{order.order_number}</p></div>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={order.invoice_sent_at && (!isAdmin || !needsSending) ? "completed" : "pending"} label={isAdmin && order.invoice_sent_at && needsSending ? "Update Not Sent" : order.invoice_sent_at ? "Sent to Branch" : order.status === "COMPLETED" ? "Ready to Send" : "Draft"} />{canEdit && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit Invoice</Button>}{isAdmin && !editing && <SendInvoiceButton order={order} onSent={load} />}</div>
    </CardHeader><CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <div><p className="text-xs text-muted-foreground uppercase tracking-wide">From</p><p className="font-medium mt-1">Aaha Central Kitchen</p></div>
      <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Bill To</p><p className="font-medium mt-1">{order.locations?.name ?? "Branch"}</p><p className="text-muted-foreground">{[order.locations?.address, order.locations?.city, order.locations?.province].filter(Boolean).join(", ")}</p></div>
    </CardContent></Card>
    {order.invoice_sent_at && <Banner tone="success">Sent to branch on {formatDateTime(order.invoice_sent_at)}.</Banner>}
    {isAdmin && order.invoice_sent_at && needsSending && <Banner tone="info">Your changes are saved. Send Updated Invoice to publish them; the branch still sees the previous version.</Banner>}
    {isAdmin && order.pickup_approval_status === "PENDING" && <Banner tone="info">Review the pending pickup request in Branch Orders before editing this invoice.</Banner>}
    {order.status !== "COMPLETED" && <Banner tone="info">This is a draft. Final billed quantities are confirmed at pickup; the invoice can be sent after completion.</Banner>}
    {editing && canEdit && <InvoiceEditor key={`${order.id}-${order.invoice_revision}`} order={order} lines={lines} onCancel={() => setEditing(false)} onSaved={async () => { await load(); setEditing(false); }} />}
    <DataTable data={lines} columns={columns} rowKey={(line) => line.id} emptyTitle="No invoice items" />
    <InvoiceTotals subtotal={subtotal} tax={tax} total={total} />
    {isAdmin && <InvoiceHistory history={history} />}
  </div>;
}
