"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order } from "@/lib/supabase/types";

type OrderWithItems = Order & {
  order_lines: { quantity: number; catalog_items: { name: string; unit_type: string } | null }[];
};

export default function BranchInvoicesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_lines(quantity, catalog_items(name, unit_type))")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setOrders(data as OrderWithItems[]);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const columns: Column<OrderWithItems>[] = [
    {
      key: "num",
      header: "Order #",
      render: (r) => <span className="font-medium">#{r.order_number}</span>,
    },
    {
      key: "items", header: "Items", className: "whitespace-normal min-w-40 max-w-64",
      render: (order) => <div className="space-y-1 text-xs">{order.order_lines.map((line, index) => <div key={index}>{line.catalog_items?.name ?? "Item"} · {line.quantity} {line.catalog_items?.unit_type ?? ""}</div>)}</div>,
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
        <div className="space-y-1"><StatusBadge
          status={ORDER_STATUS_BADGE[r.status]}
          label={ORDER_STATUS_LABEL[r.status]}
        />{r.pickup_approval_status === "PENDING" && <StatusBadge status="pending" label="Pickup Approval Pending" />}</div>
      ),
    },
    {
      key: "invoice", header: "Invoice", render: (order) => order.invoice_sent_at
        ? <Link href={`/branch/invoices/${order.id}/invoice`} onClick={(event) => event.stopPropagation()} className="text-sm text-saffron-hover font-medium underline-offset-4 hover:underline">View Invoice</Link>
        : <span className="text-xs text-muted-foreground">Not sent yet</span>,
    },
  ];

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <PageHeader
        title="Kitchen Orders"
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
