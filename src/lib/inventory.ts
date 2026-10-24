import { supabase } from "./supabase/client";
import { compareCatalogItems } from "./catalog";
export type InventoryCount = { id:string;count_date:string;submitted_at:string;submitted_name:string;notes:string;flow_version:number };
export type InventoryItem = { id:string;name:string;category?:string;unit_type:string;quantity:number|null;opening_quantity:number;received_quantity:number;used_quantity:number|null;wasted_quantity:number|null;adjustment_quantity:number;opening_editable:boolean;recorded_quantity:number|null;needs_review:boolean };
export type InventoryWorkspace = { location_id:string;branch_name:string;today:string;count_date:string;expected_count_id:string|null;expected_previous_count_id:string|null;previous_date:string|null;latest:InventoryCount|null;current:InventoryCount|null;items:InventoryItem[];history:InventoryCount[];history_total:number };
export type InventoryDraft = { opening:string;used:string;wasted:string;closing:string };
export function calculatedUsed(item:InventoryItem,draft:InventoryDraft):number {return Number(draft.opening)+item.received_quantity-Number(draft.wasted)-Number(draft.closing);}
export function inventoryDraft(item:InventoryItem):InventoryDraft {
 const draft={opening:String(item.opening_quantity),used:"0",wasted:String(item.wasted_quantity??0),closing:String(item.quantity??item.opening_quantity+item.received_quantity)};
 draft.used=String(calculatedUsed(item,draft));return draft;
}
export function updateInventoryDraft(item:InventoryItem,draft:InventoryDraft,field:"wasted"|"closing",value:string):InventoryDraft {
 const next={...draft,[field]:value};next.used=String(calculatedUsed(item,next));return next;
}
export function inventoryDayError(items:InventoryItem[],drafts:Record<string,InventoryDraft>):string|null {
 if(!items.length)return "No inventory items are available.";
 for(const item of items){
  const draft=drafts[item.id];if(!draft)return "Enter every inventory item.";
  for(const field of ["opening","wasted","closing"] as const){const value=draft[field].trim();const qty=Number(value);if(!/^\d+$/.test(value)||!Number.isInteger(qty)||qty<0||qty>2147483647)return "Enter nonnegative whole units for wasted and closing stock.";}
  if(Number(draft.opening)!==item.opening_quantity)return "Opening stock is read-only.";
  const used=calculatedUsed(item,draft);
  if(used<0)return "Wasted and closing stock cannot exceed opening plus received stock.";
  if(!Number.isInteger(used)||used>2147483647||Number(draft.used)!==used)return "Used stock must match opening + received - wasted - closing.";
 }
 return null;
}
export async function fetchInventory(signal:AbortSignal,date?:string,locationId?:string,page=0):Promise<InventoryWorkspace>{const {data,error}=await supabase.rpc("branch_inventory_workspace",{...(date?{p_count_date:date}:{}),...(locationId?{p_location_id:locationId}:{}),p_history_page:page}).abortSignal(signal);if(error)throw new Error(error.message);const workspace=data as InventoryWorkspace;return {...workspace,items:[...workspace.items].sort(compareCatalogItems)};}
