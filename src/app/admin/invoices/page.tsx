"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { Banner } from "@/components/shared/Banner";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import { invoiceDateKey } from "@/lib/invoices";
import { fetchOrders, fetchLocations, PAGE_SIZE, type OrderWithLocation } from "@/lib/admin/data";
import { useAsyncData } from "@/lib/useAsyncData";
import { Pagination } from "@/components/shared/Pagination";
import { formatMoney, formatDate } from "@/lib/format";
import { createCombinedInvoice } from "@/lib/invoice-data";
import { WeeklyInvoiceList } from "@/components/shared/WeeklyInvoiceList";
import { collectEligibleInvoiceIds, eligibleForWeekly } from "@/lib/weekly";
type Section = "orders" | "invoices";

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(0);
  const [section,setSection]=useState<Section>("orders");
  useEffect(()=>{const timer=window.setTimeout(()=>{if(new URLSearchParams(window.location.search).get("tab")==="invoices")setSection("invoices");},0);return()=>window.clearTimeout(timer);},[]);
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  const [selecting,setSelecting]=useState(false);
  const [creating,setCreating]=useState(false);
  const [actionError,setActionError]=useState<string|null>(null);

  const locations = useAsyncData(fetchLocations);
  const branches = locations.data?.filter((location) => !location.is_central) ?? [];
  const load = useCallback((signal: AbortSignal) => fetchOrders({ page, status: "BILLABLE", startDate, endDate, branchId }, signal), [page, startDate, endDate, branchId]);
  const { data, loading, error, refresh } = useAsyncData(load,{enabled:section==="orders"});
  const rows = data?.rows ?? null;
  const selectedIds=Object.keys(selected).filter((id)=>selected[id]);
  async function selectAll(){if(!branchId||!startDate||!endDate||startDate>endDate)return;setSelecting(true);setActionError(null);try{const ids=await collectEligibleInvoiceIds(index=>fetchOrders({page:index,status:"COMPLETED",startDate,endDate,branchId},new AbortController().signal),PAGE_SIZE);setSelected(ids);}catch(error){setActionError(error instanceof Error?error.message:"Unable to select invoices.");}finally{setSelecting(false);}}
  async function createWeekly(){setCreating(true);setActionError(null);try{await createCombinedInvoice({branchId,startDate,endDate},selectedIds);setSelected({});setSection("invoices");}catch(error){setActionError(error instanceof Error?error.message:"Unable to create invoice.");await refresh(true);}finally{setCreating(false);}}
  const columns: Column<OrderWithLocation>[] = [
    {key:"select",header:"Select",render:(order)=><input type="checkbox" aria-label={`Select order ${order.order_number}`} checked={!!selected[order.id]} disabled={creating||selecting||!branchId||!eligibleForWeekly(order)} onClick={(event)=>event.stopPropagation()} onChange={(event)=>setSelected((previous)=>({...previous,[order.id]:event.target.checked}))}/>},
    { key: "num", header: "Invoice #", render: (order) => <Link href={`/admin/invoices/${order.id}`} onClick={(event) => event.stopPropagation()} className="font-medium underline-offset-4 hover:underline">INV-{order.order_number}</Link> },
    { key: "branch", header: "Branch", className: "whitespace-normal", render: (order) => order.locations?.name ?? "—" },
    { key: "date", header: "Date", hideOn: "sm", render: (order) => formatDate(invoiceDateKey(order)) },
    { key: "total", header: "Total", align: "right", render: (order) => formatMoney(order.final_total_amount) },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]} /> },
  ];
  return <div className="max-w-[1200px] mx-auto space-y-5">
    <PageHeader title="Invoices" subtitle="Review individual orders, combine them into an invoice, then view and send it." />
    {(error || locations.error || actionError) && <Banner tone="danger">{error || locations.error || actionError}</Banner>}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
      <div className="space-y-1.5"><Label htmlFor="invoice-start">From Date</Label><Input id="invoice-start" type="date" max={endDate || undefined} value={startDate} disabled={selecting||creating} onChange={(event) => { setStartDate(event.target.value); setPage(0);setSelected({}); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-end">To Date</Label><Input id="invoice-end" type="date" min={startDate || undefined} value={endDate} disabled={selecting||creating} onChange={(event) => { setEndDate(event.target.value); setPage(0);setSelected({}); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-branch">Branch</Label><select disabled={selecting||creating} id="invoice-branch" value={branchId} onChange={(event) => { setBranchId(event.target.value); setPage(0);setSelected({}); }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></div>
      <Button variant="outline" disabled={selecting||creating} onClick={() => { setStartDate(""); setEndDate(""); setBranchId("");  setPage(0);setSelected({}); }}>Clear Filters</Button>
    </div>
    {startDate && endDate && startDate > endDate && <Banner tone="danger">Start date must be on or before end date.</Banner>}
    <FilterTabs tabs={[{value:"orders",label:"Individual Invoices"},{value:"invoices",label:"Combined Invoices"}]} value={section} onChange={setSection}/>
    {section==="orders"&&<>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={creating||selecting||loading||!branchId||!startDate||!endDate||startDate>endDate} onClick={selectAll}>{selecting?"Selecting…":"Select All Eligible Invoices"}</Button><Button disabled={creating||selecting||!branchId||!startDate||!endDate||startDate>endDate||!selectedIds.length} onClick={createWeekly}>{creating?"Creating…":`Combine Invoices (${selectedIds.length} selected)`}</Button>{selectedIds.length>0&&<Button variant="outline" disabled={creating||selecting} onClick={()=>setSelected({})}>Clear Selection</Button>}<p className="text-xs text-muted-foreground">Choose a branch and date range, then select completed, settled orders.</p></div>
    <DataTable data={rows} columns={columns} loading={loading} rowKey={(order) => order.id} onRowClick={(order) => router.push(`/admin/invoices/${order.id}`)}  emptyTitle="No invoices match these filters" />
    <Pagination page={data?.page ?? page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} />
    </>}
    {section!=="orders"&&<WeeklyInvoiceList key={`${section}-${branchId}-${startDate}-${endDate}`} filters={{branchId,startDate,endDate}} mode="all"/>}

  </div>;
}
