"use client";

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
  const [note, setNote] = useState("");
  const [returns, setReturns] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = request.status === "PENDING";
  const reductions = request.pickup_request_lines.filter((line) => line.pickup_quantity < line.prepared_quantity);
  const decisionsComplete = reductions.every((line) => returns[line.order_line_id] !== undefined);

  async function review(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("review_pickup", {
        p_request_id: request.id, p_approve: approve, p_note: note, p_returns: returns,
      });
      if (error) throw new Error(error.message);
      await onReviewed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to review pickup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{pending ? "Pickup Approval Pending" : "Pickup Review"}</CardTitle>
        <StatusBadge status={pending ? "pending" : request.status === "APPROVED" ? "completed" : "error"} label={request.status === "PENDING" ? "Awaiting Admin Approval" : request.status === "APPROVED" ? "Approved" : "Rejected"} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <p><span className="font-medium">Reason:</span> {request.reason}</p>
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
        {pending && canReview && reductions.map((line) => (
          <div key={line.id} className="space-y-1.5">
            <Label htmlFor={`return-${line.id}`}>{products[line.order_line_id]} · {line.prepared_quantity - line.pickup_quantity} left over</Label>
            <select id={`return-${line.id}`} disabled={busy} value={returns[line.order_line_id] === undefined ? "" : String(returns[line.order_line_id])} onChange={(event) => setReturns((previous) => ({ ...previous, [line.order_line_id]: event.target.value === "true" }))} className="w-full rounded-md border border-input bg-background p-2 text-sm">
              <option value="" disabled>Choose what happens to the remaining items</option>
              <option value="true">Return to available stock</option>
              <option value="false">Wasted / unavailable — keep out of stock</option>
            </select>
          </div>
        ))}
        {pending && canReview && <>
          <div className="space-y-1.5"><Label htmlFor={`review-${request.id}`}>Review note (required to reject)</Label><Input id={`review-${request.id}`} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} placeholder="Add a note for the branch" /></div>
          {error && <Banner tone="danger">{error}</Banner>}
          <p className="text-xs text-muted-foreground">Approval adjusts stock and the invoice together, then completes pickup. Extra pickup requires sufficient available stock.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => review(true)} disabled={busy || !decisionsComplete}>{busy ? "Saving…" : "Approve & Complete Pickup"}</Button>
            <Button variant="outline" onClick={() => review(false)} disabled={busy || !note.trim()}>Reject Request</Button>
          </div>
        </>}
        {pending && !canReview && <p className="text-sm text-muted-foreground">Your order remains Ready while central admin reviews the pickup change. This screen checks for an update every five seconds.</p>}
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
}
