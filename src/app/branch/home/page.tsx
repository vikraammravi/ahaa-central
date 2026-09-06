"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiGrid, type Kpi } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABEL } from "@/lib/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  CateringEvent,
  Location,
  Order,
  Profile,
} from "@/lib/supabase/types";

export default function BranchHomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<Location | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [catering, setCatering] = useState<CateringEvent[]>([]);
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
        const [{ data: l }, { data: o, error: oe }, { data: c, error: ce }] =
          await Promise.all([
            supabase
              .from("locations")
              .select("*")
              .eq("id", p.location_id)
              .single(),
            supabase
              .from("orders")
              .select("*")
              .eq("location_id", p.location_id)
              .order("created_at", { ascending: false }),
            supabase
              .from("catering_events")
              .select("*")
              .eq("location_id", p.location_id)
              .order("event_datetime"),
          ]);
        setBranch(l as Location);
        if (oe) setError(oe.message);
        else setOrders((o as Order[]) ?? []);
        if (ce) setError(ce.message);
        else setCatering((c as CateringEvent[]) ?? []);
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

  const upcomingCatering = catering.filter(
    (e) =>
      new Date(e.event_datetime) >= today &&
      e.status !== "CANCELLED" &&
      e.status !== "COMPLETED",
  );
  const cateringBalance = upcomingCatering.reduce(
    (s, e) => s + Number(e.balance_due),
    0,
  );

  const kpis: Kpi[] = [
    {
      label: "Today's Order",
      value: todaysOrders.length
        ? `CA$${Number(todaysOrders[0].final_total_amount).toFixed(2)}`
        : "—",
      hint: todaysOrders.length ? "Submitted" : "Not placed yet",
      tone: todaysOrders.length ? "success" : "default",
    },
    { label: "In Progress", value: `${pending}`, hint: "Kitchen orders" },
    {
      label: "Upcoming Catering",
      value: `${upcomingCatering.length}`,
      hint: "Events booked",
      tone: upcomingCatering.length ? "success" : "default",
    },
    {
      label: "Catering Balance",
      value: `CA$${cateringBalance.toFixed(2)}`,
      hint: "Due from customers",
      tone: cateringBalance > 0 ? "warn" : "default",
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow={`Good morning, ${profile?.full_name || ""}`}
        title={branch?.name ?? "Your Branch"}
        subtitle="Central kitchen and catering — all in one place."
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
            <div className="text-sm text-white/80 mt-1">
              Order before 10:00 AM
            </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Kitchen Orders</CardTitle>
            <Link
              href="/branch/invoices"
              className="text-sm text-saffron-hover"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {orders.length === 0 && !loading && (
              <EmptyState
                title="No orders yet"
                body="Start your first daily restock."
              />
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Upcoming Catering</CardTitle>
            <Link
              href="/branch/catering"
              className="text-sm text-saffron-hover"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {upcomingCatering.length === 0 && !loading && (
              <EmptyState
                title="No events booked"
                body="Log a catering booking to start tracking prep and payments."
                icon={<CalendarDays className="size-5" />}
              />
            )}
            {upcomingCatering.slice(0, 5).map((e) => {
              const dt = new Date(e.event_datetime);
              return (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {e.customer_name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {dt.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {dt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {e.guest_count}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">
                      CA${Number(e.total_amount).toFixed(2)}
                    </div>
                    {Number(e.balance_due) > 0 && (
                      <div className="text-xs text-[#D97706] mt-0.5">
                        CA${Number(e.balance_due).toFixed(2)} due
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
