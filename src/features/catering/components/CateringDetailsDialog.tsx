"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CateringEvent } from "@/lib/supabase/types";

/** Booking details are shared by the desktop table and compact cards for every role. */
export function CateringDetailsDialog({ event, compact }: { event: CateringEvent; compact: boolean }) {
  const delivery = event.fulfillment_method === "DELIVERY";
  const balance = event.balance_due == null ? null : Number(event.balance_due);
  const balanceLabel = balance == null || !Number.isFinite(balance)
    ? "Balance unavailable"
    : balance > 0 ? `${formatMoney(balance)} pending` : `${formatMoney(balance)} balance`;

  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm" className={compact ? "h-11" : "min-h-9"}>View Notes</Button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
      <DialogHeader className="shrink-0 pr-8">
        <DialogTitle className="break-words">Notes — {event.customer_name}</DialogTitle>
        <DialogDescription>Catering booking details</DialogDescription>
      </DialogHeader>
      <div role="region" aria-label="Details" tabIndex={0} className="min-h-0 space-y-4 overflow-y-auto overscroll-contain rounded text-sm focus-visible:outline-2 focus-visible:outline-ring">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 break-words"><span className="font-semibold">{event.customer_name}</span>{event.customer_phone ? ` : ${event.customer_phone}` : ""}</p>
          <p className="font-semibold">{balanceLabel}</p>
        </div>
        <p>{formatDateTime(event.event_datetime)} · {delivery ? "Delivery" : "Pickup"}</p>
        {delivery && event.delivery_address && <section className="space-y-1"><h3 className="font-semibold">Delivery address</h3><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{event.delivery_address}</p></section>}
        {event.notes && <section className="space-y-1"><h3 className="font-semibold">Notes</h3><div role="region" aria-label="Full notes" tabIndex={0} className="whitespace-pre-wrap [overflow-wrap:anywhere] rounded focus-visible:outline-2 focus-visible:outline-ring">{event.notes}</div></section>}
      </div>
    </DialogContent>
  </Dialog>;
}
