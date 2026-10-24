import { Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { RowActions } from "@/components/shared/RowActions";
import type { CatalogItem } from "@/lib/supabase/types";

export function CatalogItemStatus({active}:{active:boolean}) {
  return <StatusBadge status={active?"active":"error"} label={active?"Active":"Inactive"}/>;
}

export function CatalogItemActions({item,onEdit,onToggle}:{
  item:CatalogItem;onEdit:(item:CatalogItem)=>void;onToggle:(item:CatalogItem)=>void;
}) {
  const Icon=item.is_active?PowerOff:Power;
  const label=item.is_active?"Deactivate":"Activate";
  return <RowActions
    onEdit={()=>onEdit(item)}
    compactExtra={<Button variant="outline" className="h-11" onClick={()=>onToggle(item)}><Icon className="size-4"/>{label}</Button>}
    extra={<DropdownMenuItem onSelect={()=>onToggle(item)} variant={item.is_active?"destructive":"default"}><Icon className="size-3.5"/>{label}</DropdownMenuItem>}
  />;
}
