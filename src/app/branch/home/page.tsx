"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Order, Profile, Location } from "@/lib/supabase/types";

export default function BranchHomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<Location | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .single();
      setProfile(p as Profile);

      if (p?.location_id) {
        const [{ data: l }, { data: o, error: oe }] = await Promise.all([
          supabase.from("locations").select("*").eq("id", p.location_id).single(),
          supabase
            .from("orders")
            .select("*")
            .eq("location_id", p.location_id)
            .order("created_at", { ascending: false }),
        ]);
        setBranch(l as Location);
        if (oe) setError(oe.message);
        else setOrders((o as Order[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysOrders = orders.filter((o) => new Date(o.created_at) >= today);
  const pending = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "PREPARING",
  ).length;
  const outstandingTotal = orders
    .filter((o) => o.status === "READY" || o.status === "COMPLETED")
    .reduce((s, o) => s + Number(o.final_total_amount), 0);

  const kpis: Kpi[] = [
    {
      label: "Today's Order",
      value: todaysOrders.length ? `CA$${todaysOrders[0].final_total_amount}` : "—",
      hint: todaysOrders.length ? "Submitted" : "Not placed yet",
      tone: todaysOrders.length ? "success" : "default",
    },
    { label: "Pending", value: `${pending}`, hint: "In progress" },
    {
      label: "Total Value",
      value: `CA$${outstandingTotal.toFixed(2)}`,
      hint: "Completed orders",
      tone: "default",
    },
    { label: "Cutoff", value: "10:00 AM", hint: "Order deadline", tone: "warn" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow={`Good morning, ${profile?.full_name || ""}`}
        title={branch?.name ?? "Your Branch"}
        subtitle="Connected to Central Kitchen"
      />

      {error && <Banner tone="danger">{error}</Banner>}

      <Card className="bg-forest text-white border-transparent">
        <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-[13px] uppercase tracking-wide text-white/70">
              Morning Restock
            </div>
            <div className="mt-1 text-lg sm:text-xl font-semibold">
              Central Kitchen inventory is live.
            </div>
            <div className="text-sm text-white/80 mt-1">Order before 10:00 AM</div>
          </div>
          <Link href="/branch/order" className="shrink-0">
            <Button size="lg" className="w-full sm:w-auto">
              Start Today&apos;s Order
            </Button>
          </Link>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <KpiGrid items={kpis} />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Orders</CardTitle>
          <Link href="/branch/invoices" className="text-sm text-saffron-hover">
            View all
          </Link>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {orders.length === 0 && !loading && (
            <EmptyState title="No orders yet" body="Start your first daily restock." />
          )}
          {orders.slice(0, 5).map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div>
                <div className="text-sm font-medium">#{o.order_number}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()} · CA$
                  {Number(o.final_total_amount).toFixed(2)}
                </div>
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
  );
}
