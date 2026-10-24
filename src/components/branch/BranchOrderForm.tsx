"use client";
import { FilterBar } from "@/components/shared/FilterBar";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceTotals } from "@/components/shared/InvoiceTotals";
import { formatMoney, taxLabel, formatDate, formatDateTime } from "@/lib/format";
import { OrderItemsTable } from "@/components/branch/OrderItemsTable";
import { CatalogFilters } from "@/components/shared/CatalogFilters";
import { useCatalogFilters } from "@/lib/useCatalogFilters";
import { StockStatusFilter } from "@/components/shared/StockStatusFilter";
import { compareCatalogItems } from "@/lib/catalog";
import { BRANCH_STOCK_THRESHOLD, stockBadge } from "@/lib/stock";

import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/shared/PageHeader";

import { Banner } from "@/components/shared/Banner";
import { Spinner } from "@/components/shared/Spinner";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type { CatalogItem } from "@/lib/supabase/types";
import { fetchInventory } from "@/lib/inventory";
import { useAsyncData } from "@/lib/useAsyncData";

import { createBranchOrder, loadSubmittedOrder, updateSubmittedOrder, type SubmittedOrderEdit } from "@/lib/branch-order-data";
const HST = 0.13;

export function BranchOrderForm({editOrderId=null}:{editOrderId?:string|null}) {
  const router = useRouter();
  const [submissionId]=useState(()=>crypto.randomUUID());
  const { userId, profile } = useCurrentUser();
  const loadInventory=useCallback((signal:AbortSignal)=>fetchInventory(signal),[]);
  const inventory=useAsyncData(loadInventory,{enabled:!!profile?.location_id});
  const [existing,setExisting]=useState<SubmittedOrderEdit|null>(null);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const filters = useCatalogFilters(items);
  const [stockStatus,setStockStatus]=useState("ALL");
  const rows=filters.filtered?.filter(item=>stockStatus==="ALL"||stockBadge(item.available_stock,BRANCH_STOCK_THRESHOLD)===stockStatus)??null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller=new AbortController();
    (async()=>{
      try{
        const [catalog,original]=await Promise.all([
          supabase.from("catalog_items").select("*").eq("is_active",true).order("name").abortSignal(controller.signal),
          editOrderId?loadSubmittedOrder(editOrderId,controller.signal):Promise.resolve(null),
        ]);
        if(catalog.error)throw new Error(catalog.error.message);
        if(controller.signal.aborted)return;
        const products=new Map((catalog.data as CatalogItem[]??[]).map(item=>[item.id,item]));
        if(original){for(const item of original.items)products.set(item.id,item);setQty(original.quantities);setExisting(original);}
        setItems([...products.values()].sort(compareCatalogItems));
      }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Unable to load order items.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return()=>controller.abort();
  }, [editOrderId]);
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

      if(editOrderId){
        if(!existing)throw new Error("The order could not be loaded for editing.");
        await updateSubmittedOrder(existing,qty);
        router.push(`/branch/invoices/${existing.id}`);return;
      }
      await createBranchOrder(submissionId,qty);
      router.push(`/branch/invoices`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-4 pb-32 lg:pb-8">
      <PageHeader title={editOrderId?`Edit Order${existing?` #${existing.order_number}`:""}`:"Place Order"} subtitle={editOrderId?"Update quantities while this order is Submitted. Changes stop once central kitchen starts preparing it.":"Order before 10:00 AM."} />

      {error && <Banner tone="danger">{error}</Banner>}
      {inventory.data?.latest&&<Banner tone="info">Branch inventory last updated: {formatDate(inventory.data.latest.count_date)} · {inventory.data.latest.submitted_name} · {formatDateTime(inventory.data.latest.submitted_at)}. <a href="/branch/inventory" className="underline">View inventory</a></Banner>}

      <FilterBar columns={3}>
        <CatalogFilters inline id="order" search={filters.search} category={filters.category} categories={filters.categories} onSearch={filters.setSearch} onCategory={filters.setCategory}/>
        <StockStatusFilter id="order-stock-status" value={stockStatus} onChange={setStockStatus}/>
      </FilterBar>
      <OrderItemsTable items={rows} inventory={inventory.data?.items??[]} quantities={qty} onQuantity={setQuantity} loading={loading} disabled={submitting}/>
      {totalItems>0&&<div className="rounded-2xl border bg-surface p-4 sm:ml-auto sm:max-w-sm"><InvoiceTotals subtotal={subtotal} tax={tax} total={total}/><p className="text-xs text-muted-foreground mt-2">{totalItems} units selected. Review your order before submitting.</p></div>}
      <Dialog open={confirming} onOpenChange={(open)=>{if(!submitting)setConfirming(open);}}><DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto" showCloseButton={!submitting}><DialogHeader><DialogTitle>{editOrderId?"Review Order Changes":"Review Order"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Check the items and quantities before submitting to the central kitchen.</p><div className="divide-y">{(items??[]).filter(item=>(qty[item.id]??0)>0).map(item=><div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{qty[item.id]} {item.unit_type} × {formatMoney(item.default_price)} · Tax {taxLabel(item.is_taxable)}</p></div><span className="shrink-0">{formatMoney(qty[item.id]*Number(item.default_price))}</span></div>)}</div><InvoiceTotals subtotal={subtotal} tax={tax} total={total}/>{error && <Banner tone="danger">{error}</Banner>}<div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end [&>button]:min-h-11 [&>button]:whitespace-normal"><Button variant="outline" disabled={submitting} onClick={()=>setConfirming(false)}>Edit Order</Button><Button disabled={submitting||!totalItems} onClick={placeOrder}>{submitting?"Saving…":editOrderId?"Update Order":"Submit Order"}</Button></div></DialogContent></Dialog>
      {totalItems > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-30 lg:sticky lg:left-auto lg:right-auto lg:bottom-4 bg-surface border border-border rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{totalItems} items</div>
            <div className="text-lg font-semibold text-forest">
              CA${total.toFixed(2)}
            </div>
          </div>
          <Button size="lg" onClick={()=>setConfirming(true)} disabled={submitting}>
            {submitting && <Spinner size="xs" className="text-primary-foreground" />}
            {submitting ? "Saving…" : editOrderId?"Review Changes":"Place Order"}
          </Button>
        </div>
      )}
    </div>
  );
}
