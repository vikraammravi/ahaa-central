"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceTotals } from "@/components/shared/InvoiceTotals";
import { formatMoney, taxLabel } from "@/lib/format";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { LoadingState, Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { CatalogItem } from "@/lib/supabase/types";
import { stockBadge } from "@/lib/stock";

const HST = 0.13;

export default function BranchOrderPage() {
  const router = useRouter();
  const { userId, profile } = useCurrentUser();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) setError(error.message);
      else setItems(data as CatalogItem[]);
      setLoading(false);
    })();
  }, []);

  const filtered = (items ?? []).filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const set = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const totalItems = Object.values(qty).reduce((s, v) => s + v, 0);
  const subtotal = (items ?? []).reduce(
    (s, r) => s + (qty[r.id] ?? 0) * Number(r.default_price),
    0,
  );
  const tax = (items ?? []).reduce(
    (s, r) =>
      s +
      (r.is_taxable ? (qty[r.id] ?? 0) * Number(r.default_price) * HST : 0),
    0,
  );
  const total = subtotal + tax;

  async function placeOrder() {
    if (!items || totalItems === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!userId) throw new Error("Not signed in");
      if (!profile?.location_id)
        throw new Error("No branch assigned to your account");

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          location_id: profile.location_id,
          status: "SUBMITTED",
          subtotal,
          tax_amount: tax,
          total_amount: total,
          created_by: userId,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const lines = items
        .filter((i) => (qty[i.id] ?? 0) > 0)
        .map((i) => ({
          order_id: order.id,
          item_id: i.id,
          quantity: qty[i.id],
          unit_price: Number(i.default_price),
          is_taxable: i.is_taxable,
          line_total: qty[i.id] * Number(i.default_price),
        }));
      const { error: linesErr } = await supabase.from("order_lines").insert(lines);
      if (linesErr) throw linesErr;

      router.push(`/branch/invoices`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-4 pb-32 lg:pb-8">
      <PageHeader title="Place Order" subtitle="Order before 10:00 AM." />

      {error && <Banner tone="danger">{error}</Banner>}

      <Input
        placeholder="Search products…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <LoadingState label="Loading products…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No products available" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const q = qty[r.id] ?? 0;
            const outOfStock = r.available_stock === 0;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{r.name}</div>
                      <StatusBadge status={stockBadge(r.available_stock, r.low_stock_threshold ?? 20)} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.unit_type} · CA${Number(r.default_price).toFixed(2)} ·{" "}
                      {r.available_stock} available
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => set(r.id, -1)}
                      disabled={q === 0}
                      aria-label={`Decrease ${r.name}`}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{q}</span>
                    <Button
                      size="icon-sm"
                      onClick={() => set(r.id, +1)}
                      disabled={outOfStock || q >= r.available_stock}
                      aria-label={`Increase ${r.name}`}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(open)=>{if(!submitting)setConfirming(open);}}><DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!submitting}><DialogHeader><DialogTitle>Review Order</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Check the items and quantities before submitting to the central kitchen.</p><div className="divide-y">{(items??[]).filter(item=>(qty[item.id]??0)>0).map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{qty[item.id]} {item.unit_type} × {formatMoney(item.default_price)} · Tax {taxLabel(item.is_taxable)}</p></div><span className="shrink-0">{formatMoney(qty[item.id]*Number(item.default_price))}</span></div>)}</div><InvoiceTotals subtotal={subtotal} tax={tax} total={total}/>{error && <Banner tone="danger">{error}</Banner>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={submitting} onClick={()=>setConfirming(false)}>Edit Order</Button><Button disabled={submitting||!totalItems} onClick={placeOrder}>{submitting?"Submitting…":"Submit Order"}</Button></div></DialogContent></Dialog>
      {totalItems > 0 && (
        <div className="fixed bottom-16 lg:bottom-4 left-0 right-0 mx-4 lg:max-w-[900px] lg:mx-auto bg-surface border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{totalItems} items</div>
            <div className="text-lg font-semibold text-forest">
              CA${total.toFixed(2)}
            </div>
          </div>
          <Button size="lg" onClick={()=>setConfirming(true)} disabled={submitting}>
            {submitting && <Spinner size="xs" className="text-primary-foreground" />}
            {submitting ? "Placing…" : "Place Order"}
          </Button>
        </div>
      )}
    </div>
  );
}
