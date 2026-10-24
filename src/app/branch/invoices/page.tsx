"use client";
import { FilterBar } from "@/components/shared/FilterBar";
import { CardActions } from "@/components/shared/CardActions";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { FormSelect } from "@/components/shared/FormSelect";
import { PAGE_SIZE, pageRange } from "@/lib/pagination";
import { formatMoney, formatDate, POLL_INTERVAL } from "@/lib/format";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { PickupApprovalBadge } from "@/components/shared/PickupApprovalBadge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { Pagination } from "@/components/shared/Pagination";
import { WeeklyInvoiceList } from "@/components/shared/WeeklyInvoiceList";
import { RecordCards } from "@/components/shared/RecordCards";
import { useCompactLayout } from "@/lib/useCompactLayout";

type BranchOrder = Order & { weekly_invoices: { sent_at: string | null } | null; pickup_requests: { status: "PENDING"|"APPROVED"|"REJECTED"; requested_at:string }[] };
const STATUS_OPTIONS: {value:OrderStatus|"ALL";label:string}[] = [
  {value:"ALL",label:"All statuses"},
  ...Object.entries(ORDER_STATUS_LABEL).map(([value,label])=>({value:value as OrderStatus,label:value==="SUBMITTED"?"Pending":label})),
];
export default function BranchInvoicesPage() {
  const router = useRouter();
  const compact=useCompactLayout();
  const [section, setSection] = useState<"orders" | "invoices">("orders");
  useEffect(()=>{const timer=window.setTimeout(()=>{if(new URLSearchParams(window.location.search).get("tab")==="invoices")setSection("invoices");},0);return()=>window.clearTimeout(timer);},[]);
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const orderSearch = useDebouncedValue(search.trim().replace(/^#/, ""));
  const load = useCallback(async (signal: AbortSignal) => {
    if (orderSearch && (!/^\d+$/.test(orderSearch) || !Number.isSafeInteger(Number(orderSearch)))) return { rows: [], count: 0 };
    let query = supabase.from("orders")
      .select("*, weekly_invoices(sent_at), pickup_requests(status,requested_at)", { count: "exact" })
      .order("created_at", { ascending: false }).order("id");
    if (status !== "ALL") query = query.eq("status", status);
    if (orderSearch) query = query.eq("order_number", Number(orderSearch));
    const { data, error, count } = await query.range(...pageRange(page)).abortSignal(signal);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as BranchOrder[], count: count ?? 0 };
  }, [page, status, orderSearch]);
  const { data, loading, error } = useAsyncData(load, { enabled: section === "orders", pollInterval: POLL_INTERVAL });
  const ActionContainer=compact?CardActions:"div";
  const orderActions=(order:BranchOrder)=><ActionContainer className={compact?undefined:"flex flex-wrap gap-2"}><Button asChild size="sm" variant="outline"><Link onClick={event=>event.stopPropagation()} href={`/branch/invoices/${order.id}`}>View Order</Link></Button>{order.status==="SUBMITTED"&&<Button asChild size="sm"><Link onClick={event=>event.stopPropagation()} href={`/branch/order?edit=${order.id}`}>Edit Order</Link></Button>}</ActionContainer>;
  const columns: Column<BranchOrder>[] = [
    { key: "number", header: "Order #", render: order => <span className="font-medium">#{order.order_number}</span> },
    { key: "date", header: "Placed", render: order => formatDate(order.order_date) },
    { key: "total", header: "Total", align: "right", render: order => formatMoney(order.final_total_amount) },
    { key: "status", header: "Status", render: order => <StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]} /> },
    { key: "approval", header: "Pickup Approval", render: order => <PickupApprovalBadge requests={order.pickup_requests ?? []} /> },
    { key: "view", header: "", render: orderActions },
  ];
  const emptyTitle=search.trim()||status!=="ALL"?"No matching orders":"No orders yet";
  const emptyBody=search.trim()||status!=="ALL"?"Try another order number or status.":"Choose Place Order to place your first order.";
  const orderList=compact?<RecordCards data={data?.rows??null} loading={loading} rowKey={order=>order.id} emptyTitle={emptyTitle} emptyBody={emptyBody}>{order=><>
    <div className="flex items-start justify-between gap-2"><div><h3 className="font-medium">Order #{order.order_number}</h3><p className="text-xs text-muted-foreground">{formatDate(order.order_date)}</p></div><StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]}/></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Pickup Approval</p><PickupApprovalBadge requests={order.pickup_requests??[]}/></div><div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="font-medium">{formatMoney(order.final_total_amount)}</p></div></div>
    <div className="border-t pt-3">{orderActions(order)}</div>
  </>}</RecordCards>:<DataTable data={data?.rows??null} columns={columns} loading={loading} rowKey={order=>order.id} onRowClick={order=>router.push(`/branch/invoices/${order.id}`)} emptyTitle={emptyTitle} emptyBody={emptyBody}/>;
  return <div className="max-w-[1100px] mx-auto space-y-5">
    <PageHeader title="Orders" subtitle="Track your orders and view combined invoices." actions={<Button asChild><Link href="/branch/order">Place Order</Link></Button>} />
    <FilterTabs tabs={[{value:"orders",label:"Orders"},{value:"invoices",label:"Invoices"}]} value={section} onChange={setSection} />
    {section === "orders" ? <><FilterBar><div className="space-y-1.5"><Label htmlFor="branch-order-search">Search Order Number</Label><Input id="branch-order-search" type="search" className="h-10 cursor-text" placeholder="e.g. #15" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></div><div className="space-y-1.5"><Label htmlFor="branch-order-status">Status</Label><FormSelect id="branch-order-status" value={status} onChange={value=>{setStatus(value);setPage(0);}} options={STATUS_OPTIONS}/></div></FilterBar>{error && <Banner tone="danger">{error}</Banner>}{orderList}<Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} /></> : <div className="space-y-3"><p className="text-sm text-muted-foreground">Combined invoices sent by central admin. Open an invoice to see its items, totals and included orders.</p><FilterBar columns={3}><div className="space-y-1.5"><Label htmlFor="branch-invoice-from">From Date</Label><Input id="branch-invoice-from" type="date" value={startDate} max={endDate||undefined} onChange={event=>setStartDate(event.target.value)}/></div><div className="space-y-1.5"><Label htmlFor="branch-invoice-to">To Date</Label><Input id="branch-invoice-to" type="date" value={endDate} min={startDate||undefined} onChange={event=>setEndDate(event.target.value)}/></div><Button variant="outline" onClick={()=>{setStartDate("");setEndDate("");}}>Clear Dates</Button></FilterBar>{startDate&&endDate&&startDate>endDate?<Banner tone="danger">From date must be on or before to date.</Banner>:<WeeklyInvoiceList key={`${startDate}-${endDate}`} filters={{branchId:"",startDate,endDate}} mode="sent" isAdmin={false}/>}</div>}
  </div>;
}
