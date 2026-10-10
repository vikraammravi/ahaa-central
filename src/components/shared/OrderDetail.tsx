"use client";

import { useCallback, useEffect, useState } from "react";
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
  ORDER_STATUS_LABEL,
  nextAdminStatus,
} from "@/lib/orders";
import type { Order, OrderLine, OrderStatus, PickupRequest } from "@/lib/supabase/types";
import { PickupApprovalPanel } from "./PickupApprovalPanel";
import { pickupHasChanges, pickupQuantitiesValid } from "@/lib/pickup";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { OrderTimeline } from "./OrderTimeline";
import { TAX_RATE, POLL_INTERVAL } from "@/lib/format";

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
  const [pickupReason, setPickupReason] = useState("");
  const [requests, setRequests] = useState<PickupRequest[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    const [{ data: o, error: oe }, { data: l, error: le }, { data: history, error: he }] = await Promise.all([
      supabase
        .from("orders")
        .select("*, locations(name)")
        .eq("id", orderId)
        .single(),
      supabase
        .from("order_lines")
        .select("*, catalog_items(name, unit_type)")
        .eq("order_id", orderId),
      supabase.from("pickup_requests")
        .select("*, pickup_request_lines(*), requested_profile:profiles!pickup_requests_requested_by_fkey(full_name), reviewed_profile:profiles!pickup_requests_reviewed_by_fkey(full_name)")
        .eq("order_id", orderId).order("requested_at", { ascending: false }),
    ]);
    if (oe) setError(oe.message);
    else if (le) setError(le.message);
    else if (he) setError(he.message);
    else {
      setOrder(o as OrderWithLocation);
      const rows = (l as LineWithItem[]) ?? [];
      setLines(rows);
      setRequests((history as PickupRequest[]) ?? []);
      const initial: Record<string, { fulfilled: number; reason: string }> = {};
      rows.forEach((r) => {
        initial[r.id] = {
          fulfilled: r.fulfilled_quantity,
          reason: r.shortage_reason ?? "",
        };
      });
      if (!quiet || o.status !== "READY") setEdits(initial);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (order?.status !== "READY") return;
    const timer = window.setInterval(() => { void load(true); }, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [order?.status, load]);

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
      const { error } = await supabase.rpc("submit_pickup", {
        p_order_id: order.id,
        p_quantities: lines.map((line) => ({ line_id: line.id, quantity: edits[line.id]?.fulfilled ?? line.fulfilled_quantity })),
        p_reason: pickupReason,
      });
      if (error) throw error;
      setPickupReason("");
      await load(true);
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
  const pickupPending = order.pickup_approval_status === "PENDING";
  const canPickupEdit = canPickup && !pickupPending;
  const canPrepare = canEdit && (order.status === "SUBMITTED" || order.status === "PREPARING");
  const pickupQuantities = Object.fromEntries(lines.map((line) => [line.id, edits[line.id]?.fulfilled ?? line.fulfilled_quantity]));
  const pickupChanged = pickupHasChanges(lines, pickupQuantities);
  const pickupValid = pickupQuantitiesValid(lines, pickupQuantities);
  const canCancel = !canEdit && order.status === "SUBMITTED";

  // Live preview of the total based on current in-flight edits.
  // Mirrors the DB trigger's math: HST 13% on taxable lines only.
  const liveSubtotal = lines.reduce((s, l) => {
    const q = edits[l.id]?.fulfilled ?? l.fulfilled_quantity;
    return s + q * Number(l.unit_price);
  }, 0);
  const liveTax = lines.reduce((s, l) => {
    const q = edits[l.id]?.fulfilled ?? l.fulfilled_quantity;
    return l.is_taxable ? s + q * Number(l.unit_price) * TAX_RATE : s;
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
      key: "prepared",
      header: "Prepared",
      align: "right",
      render: (r) => requests.find((request) => request.status === "APPROVED")?.pickup_request_lines.find((line) => line.order_line_id === r.id)?.prepared_quantity ?? r.fulfilled_quantity,
    },
    {
      key: "fulfilled",
      header: order.status === "READY" || order.status === "COMPLETED" ? "Actual Pickup" : "Fulfilled",
      align: "right",
      render: (r) => {
        const editable = canPrepare || canPickupEdit;
        const maxValue = r.quantity;
        if (!editable) return pickupPending ? requests[0]?.pickup_request_lines.find((line) => line.order_line_id === r.id)?.pickup_quantity ?? r.fulfilled_quantity : r.fulfilled_quantity;
        return (
          <Input
            type="number"
            min={0}
            step={1}
            max={maxValue}
            disabled={pickingUp || saving}
            value={edits[r.id]?.fulfilled ?? r.fulfilled_quantity}
            onChange={(e) =>
              setEdits((p) => ({
                ...p,
                [r.id]: {
                  ...(p[r.id] ?? { reason: r.shortage_reason ?? "" }),
                  fulfilled: Math.max(
                    0,
                    Math.min(maxValue, Math.floor(Number(e.target.value) || 0)),
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
    ...(canPrepare
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
        const previewing = canPrepare || canPickupEdit;
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
      {!canEdit && order.invoice_sent_at && <Banner tone="success">Your invoice is available. <Link href={`/branch/invoices/${order.id}/invoice`} className="font-medium underline">View Invoice INV-{order.order_number}</Link></Banner>}

      {canPickupEdit && (
        <Banner tone="success">
          Your order is ready. Confirm the prepared quantities, or request admin approval for a different pickup quantity.
        </Banner>
      )}
      {pickupPending && <Banner tone="info">Pickup Approval Pending — the order remains Ready until admin reviews the request.</Banner>}

      {requests.map((request) => <PickupApprovalPanel key={request.id} request={request} canReview={canEdit && pickupPending} products={Object.fromEntries(lines.map((line) => [line.id, line.catalog_items?.name ?? "Item"]))} onReviewed={() => load(true)} />)}

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
                  {canPickupEdit && pickupChanged ? "Estimated after approval" : "Final"}
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
            <OrderTimeline status={order.status} updatedAt={order.updated_at} />

            {adminAdvanceTarget && (
              <Button className="w-full mt-4" onClick={advanceAdmin} disabled={saving || dirty}>
                Mark as {ORDER_STATUS_LABEL[adminAdvanceTarget]}
              </Button>
            )}
            {adminAdvanceTarget && dirty && (
              <p className="mt-2 text-xs text-muted-foreground">Save fulfillment quantities before changing the order status.</p>
            )}

            {canEdit && order.status === "READY" && (
              <div className="mt-4 text-xs text-muted-foreground text-center">
                Waiting for branch to pick up.
              </div>
            )}

            {canPickupEdit && (
              <div className="mt-4 space-y-3">
              {pickupChanged && <div className="space-y-1.5"><Label htmlFor="pickup-reason">Reason for pickup change</Label><Input id="pickup-reason" value={pickupReason} onChange={(event) => setPickupReason(event.target.value)} placeholder="Explain the extra or reduced pickup" disabled={pickingUp} /></div>}
              <Button
                className="w-full"
                onClick={branchPickup}
                disabled={pickingUp || !pickupValid || (pickupChanged && !pickupReason.trim())}
              >
                <PackageCheck className="size-4" />
                {pickingUp
                  ? "Submitting…"
                  : pickupChanged ? "Request Approval" : `Confirm Pickup · CA$${liveTotal.toFixed(2)}`}
              </Button>
              </div>
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
        {canPrepare && (
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
