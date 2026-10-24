"use client";
import { useMemo } from "react";
import { OrderQuantityControl } from "./OrderQuantityControl";


import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { catalogCategory } from "@/lib/catalog";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD } from "@/lib/format";
import { stockBadge } from "@/lib/stock";
import type { CatalogItem } from "@/lib/supabase/types";
import type { InventoryItem } from "@/lib/inventory";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { RecordCards } from "@/components/shared/RecordCards";

export function OrderItemsTable({items,inventory,quantities,onQuantity,loading,disabled}: {
  items:CatalogItem[]|null;inventory:InventoryItem[];quantities:Record<string,number>;
  onQuantity:(item:CatalogItem,quantity:number)=>void;loading:boolean;disabled:boolean;
}) {
  const balances=useMemo(()=>new Map(inventory.map(item=>[item.id,item.quantity])),[inventory]);
  const compact=useCompactLayout();
  const columns:Column<CatalogItem>[]=[
    {key:"name",header:"Item",className:"whitespace-normal min-w-28",render:item=><div className="space-y-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground sm:hidden">{catalogCategory(item.category)} · {formatMoney(item.default_price)}</p><p className="text-xs text-muted-foreground sm:hidden">Tax: {taxLabel(item.is_taxable)}</p></div>},
    {key:"category",header:"Category",hideOn:"md",render:item=>catalogCategory(item.category)},
    {key:"unit",header:"Unit",render:item=>item.unit_type},
    {key:"available",header:"Central Stock",align:"right",render:item=>item.available_stock},
    {key:"branchStock",header:"Branch Stock",align:"right",render:item=>balances.get(item.id)??"Not counted"},
    {key:"stockStatus",header:"Stock Status",render:item=><StatusBadge status={stockBadge(item.available_stock,item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)}/>},
    {key:"price",header:"Price",hideOn:"sm",align:"right",render:item=><div>{formatMoney(item.default_price)}<p className="text-xs text-muted-foreground">Tax: {taxLabel(item.is_taxable)}</p></div>},
    {key:"quantity",header:"Order Quantity",align:"right",render:item=><OrderQuantityControl item={item} quantity={quantities[item.id]??0} disabled={disabled} onQuantity={onQuantity}/>},
    {key:"total",header:"Total",hideOn:"sm",align:"right",render:item=>formatMoney((quantities[item.id]??0)*Number(item.default_price))},
  ];
  if(compact)return <RecordCards data={items} loading={loading} rowKey={item=>item.id} emptyTitle="No products match these filters">{item=><>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium break-words">{item.name}</h3><p className="text-xs text-muted-foreground">{catalogCategory(item.category)} · Unit: {item.unit_type}</p></div><StatusBadge status={stockBadge(item.available_stock,item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)}/></div>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Central Stock</dt><dd className="tabular-nums">{item.available_stock}</dd></div><div><dt className="text-xs text-muted-foreground">Branch Stock</dt><dd className="tabular-nums">{balances.get(item.id)??"Not counted"}</dd></div></dl>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><div className="text-sm"><p>{formatMoney(item.default_price)} / {item.unit_type}</p><p className="text-xs text-muted-foreground">Tax: {taxLabel(item.is_taxable)}</p><p className="mt-1 font-medium">Total {formatMoney((quantities[item.id]??0)*Number(item.default_price))}</p></div><OrderQuantityControl item={item} quantity={quantities[item.id]??0} disabled={disabled} onQuantity={onQuantity}/></div>
  </>}</RecordCards>;
  return <DataTable data={items} columns={columns} loading={loading} rowKey={item=>item.id} emptyTitle="No products match these filters"/>;
}
