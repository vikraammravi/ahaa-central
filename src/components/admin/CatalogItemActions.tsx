import { Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

import { StatusBadge } from "@/components/ui/status-badge";
import { RowActions } from "@/components/shared/RowActions";
import type { CatalogItem } from "@/lib/supabase/types";

export function CatalogItemStatus({active}:{active:boolean}) {
  return <StatusBadge status={active?"active":"error"} label={active?"Active":"Inactive"}/>;
}

export function CatalogItemActions({item,onEdit,onToggle,onDelete}:{
  item:CatalogItem;onEdit:(item:CatalogItem)=>void;onToggle:(item:CatalogItem)=>void;onDelete:(item:CatalogItem)=>Promise<void>;
}) {
  const Icon=item.is_active?PowerOff:Power;
  const label=item.is_active?"Deactivate":"Activate";
  return <RowActions
    onEdit={()=>onEdit(item)}
    onDelete={()=>onDelete(item)}
    deleteTitle={`Remove ${item.name}?`}
    deleteDescription="Items used in orders or inventory will be archived and their history preserved. Only unused items are permanently deleted."
    extraActions={<Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label={label} title={label} onClick={()=>onToggle(item)}><Icon className="size-4"/></Button>}
  />;
}
