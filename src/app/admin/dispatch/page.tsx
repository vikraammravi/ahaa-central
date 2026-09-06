"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  nextOrderStatus,
} from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };

export default function AdminDispatchPage() {
  const [orders, setOrders] = useState<OrderWithLocation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("orders")
      .select("*, locations(name)")
      .in("status", ORDER_STATUS_FLOW)
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setOrders(data as OrderWithLocation[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<OrderStatus, OrderWithLocation[]> = {
      SUBMITTED: [],
      PREPARING: [],
      READY: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    (orders ?? []).forEach((o) => g[o.status]?.push(o));
    return g;
  }, [orders]);

  async function advance(order: OrderWithLocation) {
    const next = nextOrderStatus(order.status);
    if (!next) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      <PageHeader
        title="Dispatch Board"
        subtitle="Move orders forward as you pick, prepare, and hand them off."
      />
      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORDER_STATUS_FLOW.map((col) => (
            <div
              key={col}
              className="bg-surface border border-border rounded-2xl p-4 min-h-[320px]"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-forest">
                  {ORDER_STATUS_LABEL[col]}
                </div>
                <span className="text-xs text-muted-foreground">
                  {grouped[col].length}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[col].length === 0 && <EmptyState title="No orders" />}
                {grouped[col].map((o) => {
                  const next = nextOrderStatus(o.status);
                  return (
                    <Card key={o.id}>
                      <CardContent className="p-3 space-y-2">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="block space-y-1 hover:opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">
                              #{o.order_number}
                            </div>
                            <StatusBadge
                              status={ORDER_STATUS_BADGE[o.status]}
                              label={ORDER_STATUS_LABEL[o.status]}
                            />
                          </div>
                          <div className="text-sm font-medium">
                            {o.locations?.name ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            CA${Number(o.final_total_amount).toFixed(2)}
                          </div>
                        </Link>
                        {next && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => advance(o)}
                          >
                            Advance to {ORDER_STATUS_LABEL[next]}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
