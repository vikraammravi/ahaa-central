"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { PAGE_SIZE } from "@/lib/admin/data";
import { formatMoney, formatDate, POLL_INTERVAL } from "@/lib/format";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order } from "@/lib/supabase/types";
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

type BranchOrder = Order & { weekly_invoices: { sent_at: string | null } | null; pickup_requests: { status: "PENDING"|"APPROVED"|"REJECTED"; requested_at:string }[] };
export default function BranchInvoicesPage() {
  const router = useRouter();
  const [section, setSection] = useState<"orders" | "invoices">("orders");
  useEffect(()=>{const timer=window.setTimeout(()=>{if(new URLSearchParams(window.location.search).get("tab")==="invoices")setSection("invoices");},0);return()=>window.clearTimeout(timer);},[]);
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    const { data, error, count } = await supabase.from("orders")
      .select("*, weekly_invoices(sent_at), pickup_requests(status,requested_at)", { count: "exact" })
      .order("created_at", { ascending: false }).order("id")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).abortSignal(signal);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as BranchOrder[], count: count ?? 0 };
  }, [page]);
  const { data, loading, error } = useAsyncData(load, { enabled: section === "orders", pollInterval: POLL_INTERVAL });
  const columns: Column<BranchOrder>[] = [
    { key: "number", header: "Order #", render: order => <span className="font-medium">#{order.order_number}</span> },
    { key: "date", header: "Placed", render: order => formatDate(order.order_date) },
    { key: "total", header: "Total", align: "right", render: order => formatMoney(order.final_total_amount) },
    { key: "status", header: "Status", render: order => <StatusBadge status={ORDER_STATUS_BADGE[order.status]} label={ORDER_STATUS_LABEL[order.status]} /> },
    { key: "approval", header: "Pickup Approval", render: order => <PickupApprovalBadge requests={order.pickup_requests ?? []} /> },
    { key: "view", header: "", render: order => <Button asChild size="sm" variant="outline"><Link onClick={event => event.stopPropagation()} href={`/branch/invoices/${order.id}`}>View Order</Link></Button> },
  ];
  return <div className="max-w-[1100px] mx-auto space-y-5">
    <PageHeader title="Orders" subtitle="Track your orders and view combined invoices." actions={<Button asChild><Link href="/branch/order">Place Order</Link></Button>} />
    <FilterTabs tabs={[{value:"orders",label:"Orders"},{value:"invoices",label:"Invoices"}]} value={section} onChange={setSection} />
    {section === "orders" ? <>{error && <Banner tone="danger">{error}</Banner>}<DataTable data={data?.rows ?? null} columns={columns} loading={loading} rowKey={order => order.id} onRowClick={order => router.push(`/branch/invoices/${order.id}`)} emptyTitle="No orders yet" emptyBody="Choose Place Order to place your first order." /><Pagination page={page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} /></> : <div className="space-y-3"><p className="text-sm text-muted-foreground">Combined invoices sent by central admin. Open an invoice to see its items, totals and included orders.</p><div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"><div className="space-y-1.5"><Label htmlFor="branch-invoice-from">From Date</Label><Input id="branch-invoice-from" type="date" value={startDate} max={endDate||undefined} onChange={event=>setStartDate(event.target.value)}/></div><div className="space-y-1.5"><Label htmlFor="branch-invoice-to">To Date</Label><Input id="branch-invoice-to" type="date" value={endDate} min={startDate||undefined} onChange={event=>setEndDate(event.target.value)}/></div><Button variant="outline" onClick={()=>{setStartDate("");setEndDate("");}}>Clear Dates</Button></div>{startDate&&endDate&&startDate>endDate?<Banner tone="danger">From date must be on or before to date.</Banner>:<WeeklyInvoiceList key={`${startDate}-${endDate}`} filters={{branchId:"",startDate,endDate}} mode="sent" isAdmin={false}/>}</div>}
  </div>;
}
