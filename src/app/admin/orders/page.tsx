"use client";

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
import { fetchOrders, PAGE_SIZE, type OrderWithLocation } from "@/lib/admin/data";
import { useAsyncData } from "@/lib/useAsyncData";
import { Pagination } from "@/components/shared/Pagination";
import { formatMoney, formatDateTime, POLL_INTERVAL } from "@/lib/format";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const load = useCallback((signal: AbortSignal) => fetchOrders({ page, status: "ALL" }, signal), [page]);
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
      render: (r) => (
        <select
          value={r.status}
          disabled={r.status === "READY" || r.status === "COMPLETED" || r.status === "CANCELLED" || r.pickup_approval_status === "PENDING"}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateStatus(r.id, e.target.value as OrderStatus)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {([r.status, nextAdminStatus(r.status), ...(r.status === "SUBMITTED" || r.status === "PREPARING" ? ["CANCELLED"] : [])].filter(Boolean) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div className="max-w-[1300px] mx-auto space-y-5">
      <PageHeader
        title="Branch Orders"
        subtitle="Incoming orders from branches — advance them through the fulfillment flow."
      />
      {(error || loadError) && <Banner tone="danger">{error || loadError}</Banner>}
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
        emptyTitle="No branch orders yet"
      />
      <Pagination page={data?.page ?? page} pageSize={PAGE_SIZE} count={data?.count ?? 0} busy={loading} onChange={setPage} />
    </div>
  );
}
