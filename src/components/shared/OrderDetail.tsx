"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "./DataTable";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { supabase } from "@/lib/supabase/client";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  nextOrderStatus,
} from "@/lib/orders";
import type { Order, OrderLine, OrderStatus } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };
type LineWithItem = OrderLine & {
  catalog_items: { name: string; unit_type: string } | null;
};

// Reusable order-detail view. `canEdit` toggles inline fulfillment editing
// and the "Advance status" button (admin only).
export function OrderDetail({
  orderId,
  canEdit,
}: {
  orderId: string;
  canEdit: boolean;
}) {
  const [order, setOrder] = useState<OrderWithLocation | null>(null);
  const [lines, setLines] = useState<LineWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { fulfilled: number; reason: string }>
  >({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: o, error: oe }, { data: l, error: le }] = await Promise.all([
      supabase
        .from("orders")
        .select("*, locations(name)")
        .eq("id", orderId)
        .single(),
      supabase
        .from("order_lines")
        .select("*, catalog_items(name, unit_type)")
        .eq("order_id", orderId),
    ]);
    if (oe) setError(oe.message);
    else if (le) setError(le.message);
    else {
      setOrder(o as OrderWithLocation);
      const rows = (l as LineWithItem[]) ?? [];
      setLines(rows);
      const initial: Record<string, { fulfilled: number; reason: string }> = {};
      rows.forEach((r) => {
        initial[r.id] = {
          fulfilled: r.fulfilled_quantity,
          reason: r.shortage_reason ?? "",
        };
      });
      setEdits(initial);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [orderId]);

  const dirty = lines.some(
    (l) =>
      edits[l.id]?.fulfilled !== l.fulfilled_quantity ||
      (edits[l.id]?.reason ?? "") !== (l.shortage_reason ?? ""),
  );

  async function saveFulfillment() {
    setSaving(true);
    setError(null);
    try {
      for (const line of lines) {
        const e = edits[line.id];
        if (!e) continue;
        if (
          e.fulfilled === line.fulfilled_quantity &&
          (e.reason ?? "") === (line.shortage_reason ?? "")
        )
          continue;
        const { error } = await supabase
          .from("order_lines")
          .update({
            fulfilled_quantity: e.fulfilled,
            shortage_reason: e.reason.trim() || null,
          })
          .eq("id", line.id);
        if (error) throw error;
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function advance() {
    if (!order) return;
    const next = nextOrderStatus(order.status);
    if (!next) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted animate-pulse rounded-2xl" />
        <div className="h-64 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!order) return <EmptyState title="Order not found" />;

  const columns: Column<LineWithItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <div className="font-medium">
            {r.catalog_items?.name ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {r.catalog_items?.unit_type ?? ""} · CA${Number(r.unit_price).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      key: "requested",
      header: "Requested",
      align: "right",
      render: (r) => r.quantity,
    },
    {
      key: "fulfilled",
      header: "Fulfilled",
      align: "right",
      render: (r) =>
        canEdit ? (
          <Input
            type="number"
            min={0}
            max={r.quantity}
            value={edits[r.id]?.fulfilled ?? r.fulfilled_quantity}
            onChange={(e) =>
              setEdits((p) => ({
                ...p,
                [r.id]: {
                  ...(p[r.id] ?? { reason: r.shortage_reason ?? "" }),
                  fulfilled: Math.max(
                    0,
                    Math.min(r.quantity, Number(e.target.value) || 0),
                  ),
                },
              }))
            }
            className="w-20 h-9 text-right ml-auto"
          />
        ) : (
          r.fulfilled_quantity
        ),
    },
    {
      key: "shortage",
      header: "Shortage Reason",
      hideOn: "sm",
      render: (r) => {
        const req = r.quantity;
        const ful = edits[r.id]?.fulfilled ?? r.fulfilled_quantity;
        if (req === ful) return <span className="text-muted-foreground">—</span>;
        if (canEdit) {
          return (
            <Input
              value={edits[r.id]?.reason ?? r.shortage_reason ?? ""}
              onChange={(e) =>
                setEdits((p) => ({
                  ...p,
                  [r.id]: {
                    ...(p[r.id] ?? { fulfilled: r.fulfilled_quantity }),
                    reason: e.target.value,
                  },
                }))
              }
              placeholder="e.g. Out of stock"
              className="h-9"
            />
          );
        }
        return r.shortage_reason ?? "—";
      },
    },
    {
      key: "line_total",
      header: "Final",
      align: "right",
      render: (r) => `CA$${Number(r.final_line_total ?? 0).toFixed(2)}`,
    },
  ];

  const requested = Number(order.total_amount);
  const final = Number(order.final_total_amount);
  const variance = requested - final;
  const next = nextOrderStatus(order.status);

  return (
    <div className="space-y-5">
      {error && <Banner tone="danger">{error}</Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                Order #{order.order_number}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {order.locations?.name ?? "—"} ·{" "}
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
            <StatusBadge
              status={ORDER_STATUS_BADGE[order.status]}
              label={ORDER_STATUS_LABEL[order.status]}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Requested
                </div>
                <div className="mt-1 font-semibold">CA${requested.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Final
                </div>
                <div className="mt-1 font-semibold">CA${final.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Variance
                </div>
                <div
                  className={
                    "mt-1 font-semibold " +
                    (variance > 0 ? "text-[#DC2626]" : "text-[#15803D]")
                  }
                >
                  {variance > 0 ? "−" : ""}CA${Math.abs(variance).toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {ORDER_STATUS_FLOW.map((s, i) => {
                const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);
                const reached = i <= currentIdx;
                const active = s === order.status;
                return (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        "w-2 h-2 rounded-full shrink-0 " +
                        (active
                          ? "bg-saffron"
                          : reached
                          ? "bg-[#16A34A]"
                          : "bg-border")
                      }
                    />
                    <span
                      className={
                        reached ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {ORDER_STATUS_LABEL[s]}
                    </span>
                    {active && (
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(order.updated_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {canEdit && next && (
              <Button className="w-full mt-4" onClick={advance}>
                Advance to {ORDER_STATUS_LABEL[next]}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Line Items</h2>
        {canEdit && (
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={saveFulfillment}
          >
            {saving ? "Saving…" : "Save Fulfillment"}
          </Button>
        )}
      </div>

      <DataTable
        data={lines}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle="No line items on this order"
      />
    </div>
  );
}

// Only exported so pages can use consistent types
export type { OrderStatus };
