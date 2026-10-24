"use client";
import { FilterBar } from "@/components/shared/FilterBar";

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
import { DEFAULT_STOCK_THRESHOLD, POLL_INTERVAL } from "@/lib/format";
import { RecordCards } from "@/components/shared/RecordCards";
import { useCompactLayout } from "@/lib/useCompactLayout";

export default function AdminStockPage() {
  const compact=useCompactLayout();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState("ALL");
  const load = useCallback(async (signal: AbortSignal) => (await fetchCatalog(signal)).filter(item=>item.is_active), []);
  const {data:items,loading,error:loadError,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
  const editor=useStockEditor(items,()=>{setSavedAt(new Date());void refresh(true);});
  const filters=useCatalogFilters(editor.items);
  const rows=filters.filtered?.filter(item=>status==="ALL"||stockBadge(editor.quantity(item),item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)===status)??null;
  const availableStock=(item:CatalogItem)=>editor.editing?<Input aria-label={`Available stock for ${item.name}`} type="number" inputMode="numeric" min={0} step={1} value={editor.values[item.id]??String(item.available_stock)} onChange={event=>editor.setValue(item.id,event.target.value)} className="w-24 h-11 lg:h-10 text-base lg:text-sm text-right"/>:<span>{editor.quantity(item)}{editor.pending.some(update=>update.id===item.id)&&<span className="block text-xs text-muted-foreground">Pending broadcast</span>}</span>;
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
      render:availableStock,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={stockBadge(editor.quantity(r), r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD)} />,
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
      <FilterBar columns={3}>
        <CatalogFilters inline id="stock" search={filters.search} category={filters.category} categories={filters.categories} onSearch={filters.setSearch} onCategory={filters.setCategory}/><StockStatusFilter id="stock-status" value={status} onChange={setStatus}/></FilterBar>
      {compact?<RecordCards data={rows} loading={loading} rowKey={item=>item.id} emptyTitle="No products match these filters">{item=><>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium break-words">{item.name}</h3><p className="text-xs text-muted-foreground">{catalogCategory(item.category)} · Unit: {item.unit_type}</p></div><StatusBadge status={stockBadge(editor.quantity(item),item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)}/></div>
        <div className="flex items-center justify-between gap-3 border-t pt-3"><span className="text-sm">Available</span>{availableStock(item)}</div>
      </>}</RecordCards>:<DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No products match these filters"
      />}
    </div>
  );
}
