"use client";
import { FilterBar } from "@/components/shared/FilterBar";
import { FormSelect } from "@/components/shared/FormSelect";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { SelectionCheckbox } from "@/components/shared/SelectionCheckbox";
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
import { useCompactLayout } from "@/lib/useCompactLayout";
type Section = "orders" | "invoices";

export default function AdminInvoicesPage() {
  const router = useRouter();
  const compact=useCompactLayout();
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
  const invalidDates=!!(startDate&&endDate&&startDate>endDate);
  const selectedIds=Object.keys(selected).filter((id)=>selected[id]);
  async function selectAll(){if(!branchId||invalidDates)return;setSelecting(true);setActionError(null);try{const ids=await collectEligibleInvoiceIds(index=>fetchOrders({page:index,status:"COMPLETED",startDate,endDate,branchId},new AbortController().signal),PAGE_SIZE);setSelected(ids);}catch(error){setActionError(error instanceof Error?error.message:"Unable to select invoices.");}finally{setSelecting(false);}}
  async function createWeekly(){setCreating(true);setActionError(null);try{await createCombinedInvoice({branchId,startDate,endDate},selectedIds);setSelected({});setSection("invoices");}catch(error){setActionError(error instanceof Error?error.message:"Unable to create invoice.");await refresh(true);}finally{setCreating(false);}}
  const columns: Column<OrderWithLocation>[] = [
    {key:"select",header:"Select",render:(order)=><SelectionCheckbox label={`Select order ${order.order_number}`} checked={!!selected[order.id]} disabled={creating||selecting||!branchId||!eligibleForWeekly(order)} onChange={checked=>setSelected(previous=>({...previous,[order.id]:checked}))}/>},
    { key: "num", header: "Invoice #", render: (order) => <Link href={`/admin/invoices/${order.id}`} onClick={(event) => event.stopPropagation()} className="font-medium underline-offset-4 hover:underline">INV-{order.order_number}</Link> },
    { key: "branch", header: "Branch", className: "whitespace-normal", render: (order) => order.locations?.name ?? "—" },
    { key: "date", header: "Date", hideOn: "sm", render: (order) => formatDate(invoiceDateKey(order)) },
    { key: "total", header: "Total", align: "right", render: (order) => formatMoney(order.final_total_amount) },
    { key: "status", header: "Status", render: (order) => <StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]} /> },
  ];
  return <div className={`max-w-[1200px] mx-auto space-y-5 ${compact&&section==="orders"?"pb-40":""}`}>
    <PageHeader title="Invoices" subtitle="Review individual orders, combine them into an invoice, then view and send it." />
    {(error || locations.error || actionError) && <Banner tone="danger">{error || locations.error || actionError}</Banner>}
    <FilterBar columns={4}>
      <div className="space-y-1.5"><Label htmlFor="invoice-start">From Date</Label><Input id="invoice-start" type="date" max={endDate || undefined} value={startDate} disabled={selecting||creating} onChange={(event) => { setStartDate(event.target.value); setPage(0);setSelected({}); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-end">To Date</Label><Input id="invoice-end" type="date" min={startDate || undefined} value={endDate} disabled={selecting||creating} onChange={(event) => { setEndDate(event.target.value); setPage(0);setSelected({}); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="invoice-branch">Branch</Label><FormSelect disabled={selecting||creating} id="invoice-branch" value={branchId} onChange={value=>{setBranchId(value);setPage(0);setSelected({});}} options={[{value:"",label:"All branches"},...branches.map(branch=>({value:branch.id,label:branch.name}))]}/></div>
      <Button variant="outline" disabled={selecting||creating} onClick={() => { setStartDate(""); setEndDate(""); setBranchId("");  setPage(0);setSelected({}); }}>Clear Filters</Button>
    </FilterBar>
    {startDate && endDate && startDate > endDate && <Banner tone="danger">Start date must be on or before end date.</Banner>}
    <FilterTabs tabs={[{value:"orders",label:"Individual Invoices"},{value:"invoices",label:"Combined Invoices"}]} value={section} onChange={setSection}/>
    {section==="orders"&&<>
    {!compact&&<div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={creating||selecting||loading||!branchId||invalidDates} onClick={selectAll}>{selecting?"Selecting…":"Select All Eligible Invoices"}</Button><Button disabled={creating||selecting||!branchId||invalidDates||!selectedIds.length} onClick={createWeekly}>{creating?"Creating…":`Combine Invoices (${selectedIds.length} selected)`}</Button>{selectedIds.length>0&&<Button variant="outline" disabled={creating||selecting} onClick={()=>setSelected({})}>Clear Selection</Button>}<p className="text-xs text-muted-foreground">Choose a branch and select completed, settled orders. Dates are optional filters; the combined invoice dates come from your selection.</p></div>}
    {compact&&!branchId&&<p className="text-sm text-muted-foreground">Choose a branch in Search &amp; filters to select invoices.</p>}
    <DataTable data={rows} columns={columns} loading={loading} rowKey={(order) => order.id} onRowClick={compact?undefined:(order)=>router.push(`/admin/invoices/${order.id}`)} rowClassName={order=>compact&&selected[order.id]?"bg-accent/40 ring-2 ring-forest":undefined}
      renderCard={order=><>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium">INV-{order.order_number}</h3><p className="break-words text-sm text-muted-foreground">{order.locations?.name??"—"}</p></div><SelectionCheckbox label={`Select order ${order.order_number}`} checked={!!selected[order.id]} disabled={creating||selecting||!branchId||!eligibleForWeekly(order)} onChange={checked=>setSelected(previous=>({...previous,[order.id]:checked}))}/></div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{formatDate(invoiceDateKey(order))}</span><span className="font-medium">{formatMoney(order.final_total_amount)}</span></div>
        <div className="flex items-center justify-between gap-2 border-t pt-2"><StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]}/><Button asChild variant="outline" className="min-h-11"><Link href={`/admin/invoices/${order.id}`}>View Invoice</Link></Button></div>
      </>}
      emptyTitle="No invoices match these filters" />
    <Pagination page={data?.page ?? page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} />
    {compact&&<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm" aria-label="Invoice selection"><div className="mx-auto max-w-2xl space-y-2">
      <div className="flex items-center justify-between gap-2"><span className="text-sm" role="status">{selectedIds.length} selected</span>{selectedIds.length>0&&<Button variant="ghost" className="min-h-11" disabled={creating||selecting} onClick={()=>setSelected({})}>Clear Selection</Button>}</div>
      <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={creating||selecting||loading||!branchId||invalidDates} onClick={selectAll}>{selecting?"Selecting…":"Select All"}</Button><Button className="h-auto min-h-11 whitespace-normal" disabled={creating||selecting||!branchId||invalidDates||!selectedIds.length} onClick={createWeekly}>{creating?"Creating…":"Combine"}</Button></div>
    </div></div>}
    </>}
    {section!=="orders"&&<WeeklyInvoiceList key={`${section}-${branchId}-${startDate}-${endDate}`} filters={{branchId,startDate,endDate}} mode="all"/>}

  </div>;
}
