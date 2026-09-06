"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterTabs, type FilterTab } from "@/components/shared/FilterTabs";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };

type Tab = "ALL" | "OPEN" | "COMPLETED" | "CANCELLED";
const tabs: FilterTab<Tab>[] = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const openStatuses = new Set<OrderStatus>(["SUBMITTED", "PREPARING", "READY"]);

export default function AdminInvoicesPage() {
  const [orders, setOrders] = useState<OrderWithLocation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ALL");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, locations(name)")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setOrders(data as OrderWithLocation[]);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    if (!orders) return null;
    if (tab === "ALL") return orders;
    if (tab === "OPEN") return orders.filter((o) => openStatuses.has(o.status));
    if (tab === "COMPLETED") return orders.filter((o) => o.status === "COMPLETED");
    return orders.filter((o) => o.status === "CANCELLED");
  }, [orders, tab]);

  const withCounts = useMemo<FilterTab<Tab>[]>(() => {
    if (!orders) return tabs;
    const counts: Record<Tab, number> = {
      ALL: orders.length,
      OPEN: orders.filter((o) => openStatuses.has(o.status)).length,
      COMPLETED: orders.filter((o) => o.status === "COMPLETED").length,
      CANCELLED: orders.filter((o) => o.status === "CANCELLED").length,
    };
    return tabs.map((t) => ({ ...t, count: counts[t.value] }));
  }, [orders]);

  const columns: Column<OrderWithLocation>[] = [
    {
      key: "num",
      header: "Invoice #",
      render: (r) => <span className="font-medium">INV-{r.order_number}</span>,
    },
    { key: "branch", header: "Branch", render: (r) => r.locations?.name ?? "—" },
    {
      key: "date",
      header: "Date",
      hideOn: "sm",
      render: (r) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => `CA$${Number(r.final_total_amount).toFixed(2)}`,
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
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Every branch order is billable — filter by state."
      />
      {error && <Banner tone="danger">{error}</Banner>}
      <FilterTabs tabs={withCounts} value={tab} onChange={setTab} />
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No invoices in this state"
      />
    </div>
  );
}
