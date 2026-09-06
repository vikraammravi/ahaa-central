"use client";

import { useEffect, useState } from "react";
import { PackageCheck, XCircle } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "./DataTable";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./Spinner";
import { supabase } from "@/lib/supabase/client";
import {
  ORDER_STATUS_BADGE,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  nextAdminStatus,
} from "@/lib/orders";
import type { Order, OrderLine, OrderStatus } from "@/lib/supabase/types";

type OrderWithLocation = Order & { locations: { name: string } | null };
type LineWithItem = OrderLine & {
  catalog_items: { name: string; unit_type: string } | null;
};

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
  const [pickingUp, setPickingUp] = useState(false);

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

  async function advanceAdmin() {
    if (!order) return;
    const next = nextAdminStatus(order.status);
    if (!next) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (error) setError(error.message);
    else load();
  }

  async function branchPickup() {
    if (!order) return;
    setPickingUp(true);
    setError(null);
    try {
      // Persist any qty edits the branch made at pickup (values are already
      // capped in the input to ≤ what admin prepared). The DB trigger
      // recalculates final_total_amount automatically.
      for (const line of lines) {
        const e = edits[line.id];
        if (!e) continue;
        if (e.fulfilled === line.fulfilled_quantity) continue;
        const { error: lineErr } = await supabase
          .from("order_lines")
          .update({ fulfilled_quantity: e.fulfilled })
          .eq("id", line.id);
        if (lineErr) throw lineErr;
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: "COMPLETED" })
        .eq("id", order.id);
      if (error) throw error;
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to confirm pickup");
    } finally {
      setPickingUp(false);
    }
  }

  async function cancelOrder() {
    if (!order) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id);
    if (error) setError(error.message);
    else load();
  }

  if (loading) {
    return <LoadingState label="Loading order…" minHeight="min-h-80" />;
  }

  if (!order) return <EmptyState title="Order not found" />;

  const requested = Number(order.total_amount);
  const final = Number(order.final_total_amount);
  const adminAdvanceTarget = canEdit ? nextAdminStatus(order.status) : null;
  const canPickup = !canEdit && order.status === "READY";
  const canPickupEdit = canPickup; // branch may adjust at pickup time
  const canCancel = !canEdit && order.status === "SUBMITTED";

  // Live preview of the total based on current in-flight edits.
  // Mirrors the DB trigger's math: HST 13% on taxable lines only.
  const liveSubtotal = lines.reduce((s, l) => {
    const q = edits[l.id]?.fulfilled ?? l.fulfilled_quantity;
    return s + q * Number(l.unit_price);
  }, 0);
  const liveTax = lines.reduce((s, l) => {
    const q = edits[l.id]?.fulfilled ?? l.fulfilled_quantity;
    return l.is_taxable ? s + q * Number(l.unit_price) * 0.13 : s;
  }, 0);
  const liveTotal = liveSubtotal + liveTax;
  const previewChanged =
    canPickupEdit && Math.abs(liveTotal - final) > 0.005;

  const columns: Column<LineWithItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <div className="font-medium">{r.catalog_items?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {r.catalog_items?.unit_type ?? ""} · CA$
            {Number(r.unit_price).toFixed(2)}
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
      header: canPickupEdit ? "Picked Up" : "Fulfilled",
      align: "right",
      render: (r) => {
        // Editable for admin OR for branch at pickup. Both are capped at the
        // originally requested quantity — branch can pick up more or less
        // than what admin recorded, up to what they asked for.
        const editable = canEdit || canPickupEdit;
        const maxValue = r.quantity;
        if (!editable) return r.fulfilled_quantity;
        return (
          <Input
            type="number"
            min={0}
            max={maxValue}
            value={edits[r.id]?.fulfilled ?? r.fulfilled_quantity}
            onChange={(e) =>
              setEdits((p) => ({
                ...p,
                [r.id]: {
                  ...(p[r.id] ?? { reason: r.shortage_reason ?? "" }),
                  fulfilled: Math.max(
                    0,
                    Math.min(maxValue, Number(e.target.value) || 0),
                  ),
                },
              }))
            }
            className="w-20 h-9 text-right ml-auto"
          />
        );
      },
    },
    // Shortage reason column only shown to admin (who enters it)
    ...(canEdit
      ? [
          {
            key: "shortage",
            header: "Shortage Reason",
            hideOn: "sm" as const,
            render: (r: LineWithItem) => {
              const req = r.quantity;
              const ful = edits[r.id]?.fulfilled ?? r.fulfilled_quantity;
              if (req === ful) return <span className="text-muted-foreground">—</span>;
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
            },
          },
        ]
      : []),
    {
      key: "line_total",
      header: "Final",
      align: "right",
      render: (r) => {
        // Live preview: while admin edits or branch is at pickup, reflect
        // the in-flight quantity change. Otherwise show the stored value.
        const previewing = canEdit || canPickupEdit;
        const q = previewing
          ? edits[r.id]?.fulfilled ?? r.fulfilled_quantity
          : r.fulfilled_quantity;
        const live = q * Number(r.unit_price);
        const stored = Number(r.final_line_total ?? 0);
        const changed = previewing && Math.abs(live - stored) > 0.005;
        return (
          <div>
            <div className={changed ? "font-medium text-saffron-hover" : ""}>
              CA${live.toFixed(2)}
            </div>
            {changed && (
              <div className="text-[11px] text-muted-foreground">
                was CA${stored.toFixed(2)}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {error && <Banner tone="danger">{error}</Banner>}

      {canPickup && (
        <Banner tone="success">
          Your order is ready. Adjust any quantities you're actually taking,
          then confirm pickup to complete it.
        </Banner>
      )}

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
            <div
              className={
                canEdit
                  ? "grid grid-cols-3 gap-4 text-sm"
                  : "grid grid-cols-2 gap-4 text-sm"
              }
            >
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Requested
                </div>
                <div className="mt-1 font-semibold">
                  CA${requested.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  {canPickupEdit ? "You'll be charged" : "Final"}
                </div>
                <div
                  className={
                    "mt-1 font-semibold " +
                    (canPickupEdit && previewChanged ? "text-saffron-hover" : "")
                  }
                >
                  CA${(canPickupEdit ? liveTotal : final).toFixed(2)}
                </div>
                {canPickupEdit && previewChanged && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    was CA${final.toFixed(2)}
                  </div>
                )}
              </div>
              {canEdit && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Variance
                  </div>
                  <div
                    className={
                      "mt-1 font-semibold " +
                      (requested - final > 0
                        ? "text-[#C1272D]"
                        : "text-[#15803D]")
                    }
                  >
                    {requested - final > 0 ? "−" : ""}CA$
                    {Math.abs(requested - final).toFixed(2)}
                  </div>
                </div>
              )}
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

            {adminAdvanceTarget && (
              <Button className="w-full mt-4" onClick={advanceAdmin}>
                Mark as {ORDER_STATUS_LABEL[adminAdvanceTarget]}
              </Button>
            )}

            {canEdit && order.status === "READY" && (
              <div className="mt-4 text-xs text-muted-foreground text-center">
                Waiting for branch to pick up.
              </div>
            )}

            {canPickup && (
              <Button
                className="w-full mt-4"
                onClick={branchPickup}
                disabled={pickingUp}
              >
                <PackageCheck className="size-4" />
                {pickingUp
                  ? "Confirming…"
                  : `Confirm Pickup · CA$${liveTotal.toFixed(2)}`}
              </Button>
            )}

            {canCancel && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="w-full mt-4">
                    <XCircle className="size-4" /> Cancel Order
                  </Button>
                }
                title="Cancel this order?"
                description="The central kitchen hasn't started preparing yet. Once cancelled, you'll need to place a new order."
                confirmLabel="Yes, cancel"
                cancelLabel="Keep order"
                onConfirm={cancelOrder}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Line Items</h2>
        {canEdit && (
          <Button size="sm" disabled={!dirty || saving} onClick={saveFulfillment}>
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

export type { OrderStatus };
