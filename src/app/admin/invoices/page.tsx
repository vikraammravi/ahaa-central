"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterTabs, type FilterTab } from "@/components/shared/FilterTabs";
import { Banner } from "@/components/shared/Banner";
import { SendInvoiceButton } from "@/components/admin/SendInvoiceButton";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import { invoiceDateKey, invoiceNeedsSending } from "@/lib/invoices";
import { fetchOrders, fetchLocations, PAGE_SIZE, type OrderWithLocation } from "@/lib/admin/data";
import { useAsyncData } from "@/lib/useAsyncData";
import { Pagination } from "@/components/shared/Pagination";
import { formatMoney, formatDate } from "@/lib/format";
type Tab = "ALL" | "OPEN" | "COMPLETED" | "CANCELLED";
const tabs: FilterTab<Tab>[] = [{ value: "ALL", label: "All" }, { value: "OPEN", label: "Open" }, { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }];

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(0);
  const locations = useAsyncData(fetchLocations);
  const branches = locations.data?.filter((location) => !location.is_central) ?? [];
  const load = useCallback((signal: AbortSignal) => fetchOrders({ page, status: tab, startDate, endDate, branchId }, signal), [page, tab, startDate, endDate, branchId]);
  const { data, loading, error, refresh } = useAsyncData(load);
  const rows = data?.rows ?? null;
  const withCounts = tabs.map((item) => ({ ...item, count: item.value === "OPEN" ? (data?.counts.SUBMITTED ?? 0) + (data?.counts.PREPARING ?? 0) + (data?.counts.READY ?? 0) : data?.counts[item.value] ?? 0 }));
  const columns: Column<OrderWithLocation>[] = [
    { key: "num", header: "Invoice #", render: (order) => <Link href={`/admin/invoices/${order.id}`} onClick={(event) => event.stopPropagation()} className="font-medium underline-offset-4 hover:underline">INV-{order.order_number}</Link> },
    { key: "branch", header: "Branch", className: "whitespace-normal", render: (order) => order.locations?.name ?? "—" },
    { key: "date", header: "Date", hideOn: "sm", render: (order) => formatDate(invoiceDateKey(order)) },
    { key: "total", header: "Total", align: "right", render: (order) => formatMoney(order.final_total_amount) },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]} /> },
    { key: "send", header: "Delivery", render: (order) => <div className="space-y-1"><SendInvoiceButton order={order} onSent={async () => { await refresh(true); }} />{order.invoice_sent_at && <p className="text-xs text-muted-foreground">{invoiceNeedsSending(order) ? "Update not sent" : formatDate(order.invoice_sent_at)}</p>}</div> },
  ];
  return <div className="max-w-[1200px] mx-auto space-y-5">
    <PageHeader title="Invoices" subtitle="Filter branch invoices and send final invoices after pickup is completed." />
    {(error || locations.error) && <Banner tone="danger">{error || locations.error}</Banner>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
      <div className="space-y-1.5"><Label htmlFor="invoice-start">Start Date</Label><Input id="invoice-start" type="date" max={endDate || undefined} value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(0); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-end">End Date</Label><Input id="invoice-end" type="date" min={startDate || undefined} value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(0); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-branch">Branch</Label><select id="invoice-branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(0); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></div>
      <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); setBranchId(""); setTab("ALL"); setPage(0); }}>Clear Filters</Button>
    </div>
    {startDate && endDate && startDate > endDate && <Banner tone="danger">Start date must be on or before end date.</Banner>}
    <FilterTabs tabs={withCounts} value={tab} onChange={(value) => { setTab(value); setPage(0); }} />
    <DataTable data={rows} columns={columns} loading={loading} rowKey={(order) => order.id} onRowClick={(order) => router.push(`/admin/invoices/${order.id}`)} rowClassName={(order) => !invoiceNeedsSending(order) ? "bg-muted/70 text-muted-foreground" : undefined} emptyTitle="No invoices match these filters" />
    <Pagination page={data?.page ?? page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} />
  </div>;
}
