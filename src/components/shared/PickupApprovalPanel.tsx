"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Banner } from "./Banner";
import { supabase } from "@/lib/supabase/client";
import type { PickupRequest } from "@/lib/supabase/types";

export function PickupApprovalPanel({ request, canReview, products, onReviewed }: {
  request: PickupRequest;
  canReview: boolean;
  products: Record<string, string>;
  onReviewed: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = request.status === "PENDING";
  const returnPending = request.return_status === "PENDING";
  const reductions = request.pickup_request_lines.filter((line) => line.pickup_quantity < line.prepared_quantity);
  const returns = Object.fromEntries(reductions.map((line) => [line.order_line_id, true]));

  async function review(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("review_pickup", {
        p_request_id: request.id, p_approve: approve, p_note: note, p_returns: returns,
      });
      if (error) throw new Error(error.message);
      await onReviewed();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to review pickup.");
    } finally {
      setBusy(false);
    }
  }
  async function receiveReturn() {
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.rpc("receive_pickup_return", { p_request_id: request.id, p_note: note });
      if (error) throw new Error(error.message);
      await onReviewed();
      setOpen(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to confirm return."); }
    finally { setBusy(false); }
  }

  const content = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{returnPending ? "Return Requested" : pending ? "Pickup Approval Pending" : "Pickup Review"}</CardTitle>
        <StatusBadge status={pending ? "pending" : request.status === "APPROVED" ? "completed" : "error"} label={request.status === "PENDING" ? "Awaiting Admin Approval" : request.status === "APPROVED" ? "Approved" : "Rejected"} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          {request.reason && <p><span className="font-medium">Note:</span> {request.reason}</p>}
          {request.already_collected && <p className="text-xs text-muted-foreground">Quantities were recorded as already physically collected.</p>}
          <p className="mt-1 text-xs text-muted-foreground">Requested by {request.requested_profile?.full_name ?? "Branch manager"} · {new Date(request.requested_at).toLocaleString()}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="py-2 pr-3">Item</th><th className="p-2 text-right">Prepared</th><th className="p-2 text-right">Actual Pickup</th><th className="p-2 text-right">Difference</th></tr></thead>
            <tbody>{request.pickup_request_lines.map((line) => {
              const difference = line.pickup_quantity - line.prepared_quantity;
              return <tr key={line.id} className="border-b"><td className="py-2 pr-3">{products[line.order_line_id] ?? "Item"}</td><td className="p-2 text-right">{line.prepared_quantity}</td><td className="p-2 text-right">{line.pickup_quantity}</td><td className="p-2 text-right">{difference > 0 ? "+" : ""}{difference}</td></tr>;
            })}</tbody>
          </table>
        </div>
        {pending && canReview && <>
          <div className="space-y-1.5"><Label htmlFor={`review-${request.id}`}>Notes</Label><Input id={`review-${request.id}`} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Add a note for the branch" /></div>
          {error && <Banner tone="danger">{error}</Banner>}
          <p className="text-xs text-muted-foreground">Approval adjusts stock and the invoice together, then completes pickup. Extra pickup requires sufficient available stock. Reduced quantities return to available stock.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => review(true)} disabled={busy}>{busy ? "Saving…" : "Approve"}</Button>
            <Button variant="outline" onClick={() => review(false)} disabled={busy}>{request.already_collected ? "Reject / Request Extra Items Back" : "Reject Request"}</Button>
          </div>
        </>}
        {pending && !canReview && <p className="text-sm text-muted-foreground">Your order remains Ready while central admin reviews the pickup change. This screen checks for an update every five seconds.</p>}
        {returnPending && <div className="space-y-3"><Banner tone="warn">Return the extra items below. Rejection has not credited available stock; admin confirms receipt first.</Banner>{request.pickup_request_lines.filter((line) => line.return_quantity > 0).map((line) => <p key={line.id} className="text-sm font-medium">{products[line.order_line_id]}: {line.return_quantity} to return{line.allocation_shortfall > 0 && " (allocated to another order)"}</p>)}{canReview && <><Input aria-label="Return note" placeholder="Return note (optional)" value={note} onChange={(event) => setNote(event.target.value)} /><Button disabled={busy} onClick={receiveReturn}>Confirm All Extra Items Received</Button></>}{error && <Banner tone="danger">{error}</Banner>}</div>}
        {request.return_status === "RECEIVED" && <Banner tone="success">Extra items received. The original prepared pickup is completed.{request.return_note && ` Note: ${request.return_note}`}</Banner>}
        {!pending && <div className="text-sm space-y-1">
          <p>{request.status === "REJECTED" ? "This pickup change was rejected. While the order is Ready, revise the quantities and submit again, or confirm the prepared quantities." : "Pickup completed. Stock and invoice reflect the approved quantities."}</p>
          {request.review_note && <p><span className="font-medium">Admin note:</span> {request.review_note}</p>}
          <p className="text-xs text-muted-foreground">Reviewed by {request.reviewed_profile?.full_name ?? "Central admin"}{request.reviewed_at && ` · ${new Date(request.reviewed_at).toLocaleString()}`}</p>
          {request.status === "APPROVED" && request.pickup_request_lines.filter((line) => line.pickup_quantity !== line.prepared_quantity).map((line) => (
            <p key={line.id} className="text-xs text-muted-foreground">{products[line.order_line_id]}: {line.stock_adjustment < 0 ? `${-line.stock_adjustment} extra deducted` : line.return_to_stock ? `${line.stock_adjustment} returned to stock` : "Leftovers marked wasted / unavailable"}</p>
          ))}
        </div>}
      </CardContent>
    </Card>
  );
  return <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4"><p className="text-sm font-medium">{returnPending ? "Extra items awaiting return" : pending ? "Pickup Approval Pending" : "Pickup review history"}</p><Button variant="outline" onClick={() => setOpen(true)}>{canReview ? (returnPending ? "Review Return" : pending ? "Review Pickup" : "View Review") : "View Pickup Details"}</Button></CardContent><Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent aria-describedby={undefined} className="sm:max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!busy}><DialogHeader><DialogTitle>{returnPending ? "Review Return" : "Pickup Review"}</DialogTitle></DialogHeader>{content}</DialogContent></Dialog></Card>;
}
