"use client";
import { FilterBar } from "@/components/shared/FilterBar";
import { CardActions } from "@/components/shared/CardActions";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { PickupApprovalBadge } from "@/components/shared/PickupApprovalBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
  nextAdminStatus,
} from "@/lib/orders";
import type { OrderStatus } from "@/lib/supabase/types";
import { fetchOrders, fetchLocations, PAGE_SIZE, type OrderWithLocation } from "@/lib/admin/data";
import { FormSelect } from "@/components/shared/FormSelect";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAsyncData } from "@/lib/useAsyncData";
import { Pagination } from "@/components/shared/Pagination";
import { formatMoney, formatDateTime, POLL_INTERVAL } from "@/lib/format";
import { RecordCards } from "@/components/shared/RecordCards";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminOrdersPage() {
  const router = useRouter();
  const compact=useCompactLayout();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [branchId,setBranchId]=useState("");const [date,setDate]=useState("");
  const branches=useAsyncData(fetchLocations);
  const load = useCallback((signal: AbortSignal) => fetchOrders({ page, status: "ALL",branchId,startDate:date,endDate:date }, signal), [page,branchId,date]);
  const { data, loading, error: loadError, refresh } = useAsyncData(load, { pollInterval: POLL_INTERVAL });
  const rows = data?.rows ?? null;

  async function updateStatus(id: string, status: OrderStatus) {
    setError(null);
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) setError(error.message);
    else await refresh(true);
  }

  const statusControl=(r:OrderWithLocation)=>(
        <FormSelect<OrderStatus>
          aria-label={`Status for order ${r.order_number}`}
          value={r.status}
          disabled={r.status === "READY" || r.status === "COMPLETED" || r.status === "CANCELLED" || r.pickup_approval_status === "PENDING"}
          onClick={(e) => e.stopPropagation()}
          onChange={value=>updateStatus(r.id,value)}
          options={([r.status,nextAdminStatus(r.status),...(r.status==="SUBMITTED"||r.status==="PREPARING"?["CANCELLED"]:[])].filter(Boolean) as OrderStatus[]).map(value=>({value,label:ORDER_STATUS_LABEL[value]}))}
        />
      );
  const columns: Column<OrderWithLocation>[] = [
    {
      key: "num",
      header: "Order #",
      render: (r) => <span className="font-medium">#{r.order_number}</span>,
    },
    { key: "branch", header: "Branch", render: (r) => r.locations?.name ?? "—" },
    {
      key: "date",
      header: "Submitted",
      hideOn: "sm",
      render: (r) => formatDateTime(r.created_at),
    },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      render: (r) => formatMoney(r.total_amount),
    },
    {
      key: "final",
      header: "Final",
      align: "right",
      render: (r) => formatMoney(r.final_total_amount),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusBadge
          status={ORDER_STATUS_BADGE[r.status]}
          label={ORDER_STATUS_LABEL[r.status]}
        />
      ),
    },
    { key: "approval", header: "Pickup Approval", render: (r) => <PickupApprovalBadge requests={r.pickup_requests ?? []} /> },
    {
      key: "advance",
      header: "",
      align: "right",
      render:statusControl,
    },
  ];

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <PageHeader
        title="Branch Orders"
        subtitle="Incoming orders from branches — advance them through the fulfillment flow."
      />
      {(error || loadError || branches.error) && <Banner tone="danger">{error || loadError || branches.error}</Banner>}
      <FilterBar>
        <div className="space-y-1.5"><Label htmlFor="orders-branch">Branch</Label><FormSelect id="orders-branch" value={branchId} onChange={value=>{setBranchId(value);setPage(0);}} options={[{value:"",label:"All branches"},...(branches.data??[]).filter(branch=>!branch.is_central).map(branch=>({value:branch.id,label:branch.name}))]}/></div>
        <div className="space-y-1.5"><Label htmlFor="orders-date">Order Date</Label><Input id="orders-date" type="date" className="h-10" value={date} onChange={event=>{setDate(event.target.value);setPage(0);}}/></div>
      </FilterBar>
      {compact?<RecordCards data={rows} loading={loading} rowKey={row=>row.id} emptyTitle="No branch orders yet">{row=><>
        <div className="flex items-start justify-between gap-2"><div><h3 className="font-medium">Order #{row.order_number}</h3><p className="text-sm break-words">{row.locations?.name??"—"}</p></div><StatusBadge status={ORDER_STATUS_BADGE[row.status]} label={ORDER_STATUS_LABEL[row.status]}/></div>
        <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Requested</dt><dd>{formatMoney(row.total_amount)}</dd></div><div><dt className="text-xs text-muted-foreground">Final</dt><dd>{formatMoney(row.final_total_amount)}</dd></div></dl>
        <div><p className="text-xs text-muted-foreground">Pickup Approval</p><PickupApprovalBadge requests={row.pickup_requests??[]}/></div>
        <CardActions className="border-t pt-3">{statusControl(row)}<Button asChild variant="outline"><Link href={`/admin/orders/${row.id}`}>View Order</Link></Button></CardActions>
      </>}</RecordCards>:<DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
        emptyTitle="No branch orders yet"
      />}
      <Pagination page={data?.page ?? page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} />
    </div>
  );
}
