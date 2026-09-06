"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order } from "@/lib/supabase/types";

export default function BranchInvoicesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setOrders(data as Order[]);
      setLoading(false);
    })();
  }, []);

  const columns: Column<Order>[] = [
    {
      key: "num",
      header: "Order #",
      render: (r) => <span className="font-medium">#{r.order_number}</span>,
    },
    {
      key: "date",
      header: "Placed",
      render: (r) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      hideOn: "sm",
      render: (r) => `CA$${Number(r.total_amount).toFixed(2)}`,
    },
    {
      key: "final",
      header: "Final",
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
    <div className="max-w-[1000px] mx-auto space-y-5">
      <PageHeader
        title="Orders"
        subtitle="Every order you've placed with the central kitchen."
      />
      {error && <Banner tone="danger">{error}</Banner>}
      <DataTable
        data={orders}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/branch/invoices/${r.id}`)}
        emptyTitle="No orders yet"
        emptyBody="Head to Daily Order to place your first one."
      />
    </div>
  );
}
