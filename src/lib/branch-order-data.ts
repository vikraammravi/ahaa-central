import { supabase } from "./supabase/client";
import type { CatalogItem } from "./supabase/types";

export async function createBranchOrder(orderId:string,quantities:Record<string,number>):Promise<string>{
  const lines=Object.entries(quantities).filter(([,quantity])=>quantity!==0).map(([item_id,quantity])=>({item_id,quantity}));
  if(!lines.length||lines.some(line=>!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>2147483647))throw new Error("Select at least one item using positive whole units.");
  const {data,error}=await supabase.rpc("create_branch_order",{p_order_id:orderId,p_quantities:lines});
  if(error)throw new Error(error.message);
  if(!data)throw new Error("The order could not be submitted.");
  return data as string;
}

export type SubmittedOrderEdit={id:string;order_number:number;updated_at:string|null;items:CatalogItem[];quantities:Record<string,number>};
export async function loadSubmittedOrder(id:string,signal:AbortSignal):Promise<SubmittedOrderEdit>{
  const {data,error}=await supabase.from("orders").select("id,order_number,status,updated_at,order_lines(item_id,quantity,unit_price,is_taxable,catalog_items(*))").eq("id",id).abortSignal(signal).single();
  if(error)throw new Error(error.message);
  if(!data||data.status!=="SUBMITTED")throw new Error("Only Submitted orders can be edited. Return to Orders to check its current status.");
  const lines=data.order_lines as unknown as {item_id:string;quantity:number;unit_price:number;is_taxable:boolean;catalog_items:CatalogItem|null}[];
  if(lines.some(line=>!line.catalog_items))throw new Error("An original item is no longer available. Contact central kitchen to update this order.");
  return {id:data.id,order_number:data.order_number,updated_at:data.updated_at,items:lines.map(line=>({...line.catalog_items!,default_price:Number(line.unit_price),is_taxable:line.is_taxable})),quantities:Object.fromEntries(lines.map(line=>[line.item_id,line.quantity]))};
}
export async function updateSubmittedOrder(order:SubmittedOrderEdit,quantities:Record<string,number>):Promise<void>{
  if(Object.values(quantities).some(quantity=>!Number.isInteger(quantity)||quantity<0||quantity>2147483647))throw new Error("Use nonnegative whole units for order quantities.");
  const lines=Object.entries(quantities).filter(([,quantity])=>quantity>0).map(([item_id,quantity])=>({item_id,quantity}));
  if(!lines.length||lines.some(line=>!Number.isInteger(line.quantity)||line.quantity>2147483647))throw new Error("Select at least one item using whole units.");
  const {error}=await supabase.rpc("edit_submitted_branch_order",{p_order_id:order.id,p_quantities:lines,p_expected_updated_at:order.updated_at});
  if(error)throw new Error(error.message);
}
