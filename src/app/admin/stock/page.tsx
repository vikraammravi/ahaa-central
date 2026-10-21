"use client";

import { formatTime } from "@/lib/format";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStockEditor } from "@/lib/useStockEditor";
import { StockStatusFilter } from "@/components/shared/StockStatusFilter";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";

import type { CatalogItem } from "@/lib/supabase/types";
import { stockBadge } from "@/lib/stock";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchCatalog } from "@/lib/admin/data";
import { useCatalogFilters } from "@/lib/useCatalogFilters";
import { catalogCategory } from "@/lib/catalog";
import { CatalogFilters } from "@/components/shared/CatalogFilters";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD, POLL_INTERVAL } from "@/lib/format";

export default function AdminStockPage() {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState("ALL");
  const load = useCallback(async (signal: AbortSignal) => (await fetchCatalog(signal)).filter(item=>item.is_active), []);
  const {data:items,loading,error:loadError,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
  const editor=useStockEditor(items,()=>{setSavedAt(new Date());void refresh(true);});
  const filters=useCatalogFilters(editor.items);
  const rows=filters.filtered?.filter(item=>status==="ALL"||stockBadge(editor.quantity(item),item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)===status)??null;
  const columns: Column<CatalogItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {key:"category",header:"Category",render:r=>catalogCategory(r.category)},
    {key:"unit",header:"Unit",render:r=>r.unit_type},
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (r) => editor.editing?<Input aria-label={`Available stock for ${r.name}`} type="number" inputMode="numeric" min={0} step={1} value={editor.values[r.id]??String(r.available_stock)} onChange={event=>editor.setValue(r.id,event.target.value)} className="w-24 h-10 text-base sm:text-sm text-right ml-auto"/>:<span>{editor.quantity(r)}{editor.pending.some(update=>update.id===r.id)&&<span className="block text-xs text-muted-foreground">Pending broadcast</span>}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={stockBadge(editor.quantity(r), r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD)} />,
    },
    { key: "threshold", header: "Threshold", align: "right", render: (r) => r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      hideOn: "sm",
      render: (r) => formatMoney(r.default_price),
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      hideOn: "md",
      render: (r) => taxLabel(r.is_taxable),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Daily Stock"
        subtitle="Stock updates every 5 seconds. Fulfilled quantities are deducted when orders become Ready."
        actions={
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 max-w-full">
            {editor.editing?<><Button variant="outline" onClick={editor.cancel}>Cancel</Button><Button onClick={editor.save}>Save Changes</Button></>:<Button variant="outline" disabled={!items?.length||loading||editor.saving} onClick={editor.edit}>Edit</Button>}
            <Button className={editor.editing?"col-span-2 sm:col-auto":undefined} disabled={editor.editing||!editor.pending.length||editor.saving} onClick={editor.broadcast}>{editor.saving?"Broadcasting…":"Broadcast Changes"}</Button>
          </div>
        }
      />
      {loadError && <Banner tone="danger">{loadError}</Banner>}
      {editor.error&&<Banner tone="danger">{editor.error} Review your edits, or discard and reload if stock changed elsewhere.</Banner>}
      {(editor.editing||editor.pending.length>0)&&<Banner tone="info">{editor.editing?"Edit quantities, then save your changes.":`${editor.pending.length} saved stock change(s) pending broadcast.`} Changes are kept on this page until Broadcast Changes is selected. <Button variant="outline" size="sm" disabled={editor.saving} onClick={editor.discard}>Discard Changes</Button></Banner>}
      {savedAt && (
        <Banner tone="success">
          Stock updated at {formatTime(savedAt)}. Branches will see
          the new numbers on their next order.
        </Banner>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px] items-end gap-3">
        <CatalogFilters id="stock" search={filters.search} category={filters.category} categories={filters.categories} onSearch={filters.setSearch} onCategory={filters.setCategory}/><StockStatusFilter id="stock-status" value={status} onChange={setStatus}/></div>
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No products match these filters"
      />
    </div>
  );
}
