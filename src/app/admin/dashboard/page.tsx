"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { Banner } from "@/components/shared/Banner";
import { EmptyState } from "@/components/shared/EmptyState";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import type { CatalogItem, Order } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<OrderWithLocation[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ data: o, error: oe }, { data: c, error: ce }] = await Promise.all([
        supabase
          .from("orders")
          .select("*, locations(name)")
          .gte("created_at", today.toISOString())
          .order("created_at", { ascending: false }),
        supabase.from("catalog_items").select("*").eq("is_active", true),
      ]);
      if (oe) setError(oe.message);
      else if (ce) setError(ce.message);
      else {
        setOrders((o as OrderWithLocation[]) ?? []);
        setItems((c as CatalogItem[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const pendingOrders = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "PREPARING",
  ).length;
  const revenueToday = orders.reduce(
    (s, o) => s + Number(o.final_total_amount),
    0,
  );
  const lowStock = items.filter((i) => i.available_stock < 20).length;

  const kpis: Kpi[] = [
    { label: "Orders Today", value: `${orders.length}` },
    { label: "Pending", value: `${pendingOrders}`, tone: "warn" },
    { label: "Revenue Today", value: `CA$${revenueToday.toFixed(2)}`, tone: "success" },
    { label: "Low / Out of Stock", value: `${lowStock}`, tone: lowStock ? "warn" : "default" },
  ];

  const lowItems = items
    .filter((i) => i.available_stock < 20)
    .sort((a, b) => a.available_stock - b.available_stock)
    .slice(0, 6);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <PageHeader eyebrow="Good morning" title="Central Kitchen Operations" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Low Stock</CardTitle>
            <a href="/admin/stock" className="text-sm text-saffron-hover">
              Manage stock
            </a>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowItems.length === 0 && !loading && <EmptyState title="Everything stocked" />}
            {lowItems.map((i) => (
              <div key={i.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-muted-foreground">{i.available_stock} left</span>
                </div>
                <Progress
                  value={Math.min(100, (i.available_stock / 50) * 100)}
                  className="mt-1.5 h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Branch Orders</CardTitle>
            <a href="/admin/orders" className="text-sm text-saffron-hover">
              View all
            </a>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {orders.length === 0 && !loading && <EmptyState title="No orders today" />}
            {orders.slice(0, 5).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">{o.locations?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">#{o.order_number}</div>
                </div>
                <StatusBadge
                  status={ORDER_STATUS_BADGE[o.status]}
                  label={ORDER_STATUS_LABEL[o.status]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
