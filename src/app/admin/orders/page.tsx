"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterTabs, type FilterTab } from "@/components/shared/FilterTabs";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_LABEL,
} from "@/lib/orders";
import type { Order, OrderStatus, Location } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };

type Tab = "ALL" | OrderStatus;
const tabs: FilterTab<Tab>[] = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithLocation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ALL");

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*, locations(name)")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setOrders(data as OrderWithLocation[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    if (!orders) return null;
    return tab === "ALL" ? orders : orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const withCounts = useMemo<FilterTab<Tab>[]>(() => {
    if (!orders) return tabs;
    return tabs.map((t) => ({
      ...t,
      count:
        t.value === "ALL"
          ? orders.length
          : orders.filter((o) => o.status === t.value).length,
    }));
  }, [orders]);

  async function updateStatus(id: string, status: OrderStatus) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (error) setError(error.message);
    else load();
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
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      render: (r) => `CA$${Number(r.total_amount).toFixed(2)}`,
    },
    {
      key: "final",
      header: "Final",
      align: "right",
      render: (r) => {
        const req = Number(r.total_amount);
        const fin = Number(r.final_total_amount);
        const diff = req - fin;
        return (
          <div>
            <div>CA${fin.toFixed(2)}</div>
            {diff > 0 && (
              <div className="text-[11px] text-[#DC2626]">
                −CA${diff.toFixed(2)} shortage
              </div>
            )}
          </div>
        );
      },
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
    {
      key: "advance",
      header: "",
      align: "right",
      render: (r) => (
        <select
          value={r.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateStatus(r.id, e.target.value as OrderStatus)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => (
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
      {error && <Banner tone="danger">{error}</Banner>}
      <FilterTabs tabs={withCounts} value={tab} onChange={setTab} />
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/admin/orders/${r.id}`)}
        emptyTitle="No orders in this state"
      />
    </div>
  );
}
