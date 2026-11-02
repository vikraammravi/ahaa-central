import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogItem } from "@/lib/supabase/types";

export function OrderQuantityControl({item,quantity,disabled,onQuantity}:{
  item:CatalogItem;quantity:number;disabled:boolean;onQuantity:(item:CatalogItem,quantity:number)=>void;
}) {
  return <div className="flex items-center justify-end gap-1">
    <Button variant="outline" size="icon" className="size-11 lg:h-10 lg:w-9" disabled={disabled||quantity===0} aria-label={`Decrease ${item.name}`} onClick={()=>onQuantity(item,quantity-1)}><Minus className="size-3.5"/></Button>
    <Input aria-label={`Order quantity for ${item.name}`} type="number" inputMode="numeric" min={0} max={item.available_stock} step={1} value={quantity===0?"":quantity} placeholder="0" disabled={disabled||item.available_stock<=0} onChange={event=>onQuantity(item,Number(event.target.value))} className="w-16 h-11 lg:h-10 px-1 text-center text-base lg:text-sm"/>
    <Button size="icon" className="size-11 lg:h-10 lg:w-9" disabled={disabled||quantity>=item.available_stock} aria-label={`Increase ${item.name}`} onClick={()=>onQuantity(item,quantity+1)}><Plus className="size-3.5"/></Button>
  </div>;
}
