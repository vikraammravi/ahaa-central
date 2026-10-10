"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import type { Order } from "@/lib/supabase/types";
import { invoiceNeedsSending } from "@/lib/invoices";

export function SendInvoiceButton({ order, onSent }: {
  order: Pick<Order, "id" | "status" | "invoice_sent_at" | "invoice_revision" | "invoice_sent_revision">;
  onSent: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = !invoiceNeedsSending(order);
  async function send() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.rpc("send_invoice_to_branch", { p_order_id: order.id });
      if (error) throw new Error(error.message);
      await onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send invoice.");
    } finally {
      setBusy(false);
    }
  }
  return <div onClick={(event) => event.stopPropagation()}>
    <Button variant={sent ? "secondary" : "outline"} size="sm" disabled={busy || sent || order.status !== "COMPLETED"} onClick={send} title={sent ? "Latest version sent to branch" : order.status !== "COMPLETED" ? "Complete pickup before sending the final invoice" : "Publish this invoice in the branch app"}>
      {sent ? <Check className="size-3.5" /> : <Send className="size-3.5" />}{sent ? "Sent" : busy ? "Sending…" : order.invoice_sent_at ? "Send Updated Invoice" : "Send to Branch"}
    </Button>
    {error && <p role="alert" className="mt-1 max-w-64 whitespace-normal text-xs text-destructive">{error}</p>}
  </div>;
}
