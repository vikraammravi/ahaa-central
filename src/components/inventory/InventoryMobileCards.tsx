import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryItem } from "@/lib/inventory";
import { RECORD_CARD_GRID } from "@/components/shared/RecordCards";

type Field = "opening" | "used" | "wasted" | "closing";
export function InventoryMobileCards({items,loading,renderCell,isChanged}:{
  items:InventoryItem[];loading:boolean;
  renderCell:(item:InventoryItem,field:Field,label:string)=>ReactNode;
  isChanged:(item:InventoryItem)=>boolean;
}) {
  if(loading&&!items.length)return <p role="status">Loading inventory…</p>;
  if(!items.length)return <p className="py-6 text-center text-sm text-muted-foreground">No inventory items match your search</p>;
  return <div className={RECORD_CARD_GRID} aria-label="Inventory items">{items.map(item=><Card key={item.id} size="sm" className="min-w-0"><CardContent className="min-w-0 space-y-3">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-medium break-words">{item.name}</h3><p className="text-xs text-muted-foreground">Unit: {item.unit_type}</p></div>{isChanged(item)&&<span className="rounded bg-muted px-2 py-1 text-xs">Changed</span>}</div>
    <dl className="grid grid-cols-3 gap-2 border-b pb-3 text-sm">{(["opening","received","used"] as const).map(field=><div key={field}><dt className="text-xs text-muted-foreground">{{opening:"Opening",received:"Received",used:"Used"}[field]}</dt><dd className="mt-1 tabular-nums">{field==="received"?item.received_quantity:renderCell(item,field,field==="opening"?"Opening":"Used")}</dd></div>)}</dl>
    <div className="grid grid-cols-2 gap-3">{(["wasted","closing"] as const).map(field=><div key={field} className="space-y-1"><div className="text-xs text-muted-foreground">{field==="wasted"?"Wasted":"Closing"}</div>{renderCell(item,field,field==="wasted"?"Wasted":"Closing")}</div>)}</div>
  </CardContent></Card>)}</div>;
}
