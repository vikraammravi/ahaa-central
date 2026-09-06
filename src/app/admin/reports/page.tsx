"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, Order } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderWithLocation[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: o, error: oe }, { data: c }] = await Promise.all([
        supabase.from("orders").select("*, locations(name)"),
        supabase.from("catalog_items").select("*").eq("is_active", true),
      ]);
      if (oe) setError(oe.message);
      else {
        setOrders((o as OrderWithLocation[]) ?? []);
        setItems((c as CatalogItem[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const totalRevenue = orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + Number(o.final_total_amount), 0);
  const outstanding = orders
    .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
    .reduce((s, o) => s + Number(o.total_amount), 0);
  const totalOrders = orders.length;
  const lowStock = items.filter((i) => i.available_stock < 20).length;

  const kpis: Kpi[] = [
    { label: "Total Orders", value: `${totalOrders}` },
    { label: "Revenue Collected", value: `CA$${totalRevenue.toFixed(2)}`, tone: "success" },
    { label: "Outstanding", value: `CA$${outstanding.toFixed(2)}`, tone: "danger" },
    { label: "Low / Out of Stock", value: `${lowStock}`, tone: "warn" },
  ];

  const byBranch = new Map<string, number>();
  orders.forEach((o) => {
    const name = o.locations?.name ?? "Unknown";
    byBranch.set(name, (byBranch.get(name) ?? 0) + Number(o.final_total_amount));
  });
  const branches = Array.from(byBranch.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Production, orders, revenue, and outstanding balances."
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid items={kpis} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branch Comparison</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {branches.length === 0 && <EmptyState title="No orders yet" />}
            {branches.map(([name, total]) => (
              <div
                key={name}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="text-sm font-medium">{name}</div>
                <div className="text-sm font-medium">CA${total.toFixed(2)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outstanding Orders</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length ===
              0 && <EmptyState title="Nothing outstanding" />}
            {orders
              .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
              .map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-medium">#{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.locations?.name ?? "—"} ·{" "}
                      {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[#D97706]">
                    CA${Number(o.total_amount).toFixed(2)}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
