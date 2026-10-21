"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceTotals } from "@/components/shared/InvoiceTotals";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD, formatDate, formatDateTime } from "@/lib/format";
import { OrderItemsTable } from "@/components/branch/OrderItemsTable";
import { CatalogFilters } from "@/components/shared/CatalogFilters";
import { useCatalogFilters } from "@/lib/useCatalogFilters";
import { StockStatusFilter } from "@/components/shared/StockStatusFilter";
import { stockBadge } from "@/lib/stock";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/shared/PageHeader";

import { Banner } from "@/components/shared/Banner";
import { Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { CatalogItem } from "@/lib/supabase/types";
import { fetchInventory } from "@/lib/inventory";
import { useAsyncData } from "@/lib/useAsyncData";

const HST = 0.13;

export default function BranchOrderPage() {
  const router = useRouter();
  const { userId, profile } = useCurrentUser();
  const loadInventory=useCallback((signal:AbortSignal)=>fetchInventory(signal),[]);
  const inventory=useAsyncData(loadInventory,{enabled:!!profile?.location_id});
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const filters = useCatalogFilters(items);
  const [stockStatus,setStockStatus]=useState("ALL");
  const rows=filters.filtered?.filter(item=>stockStatus==="ALL"||stockBadge(item.available_stock,item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)===stockStatus)??null;
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

  function setQuantity(item:CatalogItem,value:number) {
    if(submitting)return;
    const quantity=Number.isFinite(value)?Math.min(item.available_stock,Math.max(0,Math.floor(value))):0;
    setQty(previous=>({...previous,[item.id]:quantity}));
  }
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
    <div className="max-w-[1200px] mx-auto space-y-4 pb-32 lg:pb-8">
      <PageHeader title="Place Order" subtitle="Order before 10:00 AM." />

      {error && <Banner tone="danger">{error}</Banner>}
      {inventory.data?.latest&&<Banner tone="info">Branch inventory last updated: {formatDate(inventory.data.latest.count_date)} · {inventory.data.latest.submitted_name} · {formatDateTime(inventory.data.latest.submitted_at)}. <a href="/branch/inventory" className="underline">View inventory</a></Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px] items-end gap-3">
        <CatalogFilters id="order" search={filters.search} category={filters.category} categories={filters.categories} onSearch={filters.setSearch} onCategory={filters.setCategory}/>
        <StockStatusFilter id="order-stock-status" value={stockStatus} onChange={setStockStatus}/>
      </div>
      <OrderItemsTable items={rows} inventory={inventory.data?.items??[]} quantities={qty} onQuantity={setQuantity} loading={loading} disabled={submitting}/>
      {totalItems>0&&<div className="rounded-2xl border bg-surface p-4 sm:ml-auto sm:max-w-sm"><InvoiceTotals subtotal={subtotal} tax={tax} total={total}/><p className="text-xs text-muted-foreground mt-2">{totalItems} units selected. Review your order before submitting.</p></div>}
      <Dialog open={confirming} onOpenChange={(open)=>{if(!submitting)setConfirming(open);}}><DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!submitting}><DialogHeader><DialogTitle>Review Order</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Check the items and quantities before submitting to the central kitchen.</p><div className="divide-y">{(items??[]).filter(item=>(qty[item.id]??0)>0).map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{qty[item.id]} {item.unit_type} × {formatMoney(item.default_price)} · Tax {taxLabel(item.is_taxable)}</p></div><span className="shrink-0">{formatMoney(qty[item.id]*Number(item.default_price))}</span></div>)}</div><InvoiceTotals subtotal={subtotal} tax={tax} total={total}/>{error && <Banner tone="danger">{error}</Banner>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={submitting} onClick={()=>setConfirming(false)}>Edit Order</Button><Button disabled={submitting||!totalItems} onClick={placeOrder}>{submitting?"Submitting…":"Submit Order"}</Button></div></DialogContent></Dialog>
      {totalItems > 0 && (
        <div className="sticky bottom-20 lg:bottom-4 bg-surface border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3">
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
