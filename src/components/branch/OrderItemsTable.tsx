"use client";
import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { catalogCategory } from "@/lib/catalog";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD } from "@/lib/format";
import { stockBadge } from "@/lib/stock";
import type { CatalogItem } from "@/lib/supabase/types";
import type { InventoryItem } from "@/lib/inventory";

export function OrderItemsTable({items,inventory,quantities,onQuantity,loading,disabled}: {
  items:CatalogItem[]|null;inventory:InventoryItem[];quantities:Record<string,number>;
  onQuantity:(item:CatalogItem,quantity:number)=>void;loading:boolean;disabled:boolean;
}) {
  const balances=useMemo(()=>new Map(inventory.map(item=>[item.id,item.quantity])),[inventory]);
  const columns:Column<CatalogItem>[]=[
    {key:"name",header:"Item",className:"whitespace-normal min-w-28",render:item=><div className="space-y-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground sm:hidden">{catalogCategory(item.category)} · {formatMoney(item.default_price)}</p><p className="text-xs text-muted-foreground sm:hidden">Tax: {taxLabel(item.is_taxable)}</p></div>},
    {key:"category",header:"Category",hideOn:"md",render:item=>catalogCategory(item.category)},
    {key:"unit",header:"Unit",render:item=>item.unit_type},
    {key:"available",header:"Central Stock",align:"right",render:item=>item.available_stock},
    {key:"branchStock",header:"Branch Stock",align:"right",render:item=>balances.get(item.id)??"Not counted"},
    {key:"stockStatus",header:"Stock Status",render:item=><StatusBadge status={stockBadge(item.available_stock,item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD)}/>},
    {key:"price",header:"Price",hideOn:"sm",align:"right",render:item=><div>{formatMoney(item.default_price)}<p className="text-xs text-muted-foreground">Tax: {taxLabel(item.is_taxable)}</p></div>},
    {key:"quantity",header:"Order Quantity",align:"right",render:item=>{
      const quantity=quantities[item.id]??0;
      return <div className="space-y-1"><div className="flex items-center justify-end gap-1">
        <Button variant="outline" size="icon-sm" className="h-10 w-9" disabled={disabled||quantity===0} aria-label={`Decrease ${item.name}`} onClick={()=>onQuantity(item,quantity-1)}><Minus className="size-3.5"/></Button>
        <Input aria-label={`Order quantity for ${item.name}`} type="number" inputMode="numeric" min={0} max={item.available_stock} step={1} value={quantity===0?"":quantity} placeholder="0" disabled={disabled||item.available_stock<=0} onChange={event=>onQuantity(item,Number(event.target.value))} className="w-12 sm:w-16 h-10 px-1 text-center text-base sm:text-sm"/>
        <Button size="icon-sm" className="h-10 w-9" disabled={disabled||quantity>=item.available_stock} aria-label={`Increase ${item.name}`} onClick={()=>onQuantity(item,quantity+1)}><Plus className="size-3.5"/></Button>
      </div><p className="text-xs sm:hidden">{formatMoney(quantity*Number(item.default_price))}</p></div>;
    }},
    {key:"total",header:"Total",hideOn:"sm",align:"right",render:item=>formatMoney((quantities[item.id]??0)*Number(item.default_price))},
  ];
  return <DataTable data={items} columns={columns} loading={loading} rowKey={item=>item.id} emptyTitle="No products match these filters"/>;
}
