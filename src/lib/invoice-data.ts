import { supabase } from "./supabase/client";
import { lastPage, pageRange } from "./pagination";
import type { InvoiceFilters } from "./weekly";
import type { WeeklyInvoice, WeeklyInvoiceDetails } from "./supabase/types";

export type InvoiceRow = Omit<WeeklyInvoice, "orders"> & { orders: {id:string;order_number:number;order_date:string;final_total_amount:number}[]; weekly_invoice_publications: {revision:number;snapshot:WeeklyInvoiceDetails}[] };
export async function fetchCombinedInvoices(filters:InvoiceFilters,mode:"all"|"sent",isAdmin:boolean,page:number,signal:AbortSignal):Promise<{rows:InvoiceRow[];count:number;page:number}> {
    if(filters.startDate&&filters.endDate&&filters.startDate>filters.endDate) return {rows:[],count:0,page:0};
    let query=supabase.from("weekly_invoices").select(isAdmin ? "*, locations(name), orders(id,order_number,order_date,final_total_amount)" : "*, locations(name), weekly_invoice_publications(revision,snapshot)",{count:"exact"}).order("created_at",{ascending:false}).order("id");
    if(!isAdmin) query=query.order("revision",{referencedTable:"weekly_invoice_publications",ascending:false}).limit(1,{referencedTable:"weekly_invoice_publications"});
    if(mode==="sent") query=query.not("sent_at","is",null);
    if(filters.branchId)query=query.eq("location_id",filters.branchId);
    if(filters.startDate)query=query.gte("end_date",filters.startDate);
    if(filters.endDate)query=query.lte("start_date",filters.endDate);
    const {data,error,count}=await query.range(...pageRange(page)).abortSignal(signal);
    if(error)throw new Error(error.message);
    const total=count??0;
    if(page>lastPage(total)) return fetchCombinedInvoices(filters,mode,isAdmin,lastPage(total),signal);
    return {rows:(data??[]) as unknown as InvoiceRow[],count:total,page};
}
export async function sendCombinedInvoice(id:string):Promise<void>{
  const {error}=await supabase.rpc("send_weekly_invoice",{p_invoice_id:id});
  if(error)throw new Error(error.message);
}

export async function createCombinedInvoice(filters: InvoiceFilters, orderIds: string[]): Promise<string> {
  if (!filters.branchId || (filters.startDate && filters.endDate && filters.startDate > filters.endDate) || !orderIds.length || new Set(orderIds).size!==orderIds.length) {
    throw new Error("Choose a branch and at least one invoice. Any date filters must be valid.");
  }
  let startDate="",endDate="";
  // Read selected IDs in bounded batches, including selections from other pages.
  for(let offset=0;offset<orderIds.length;offset+=100){
    const ids=orderIds.slice(offset,offset+100);
    const {data,error}=await supabase.from("orders").select("id,order_date").in("id",ids).eq("location_id",filters.branchId);
    if(error)throw new Error(error.message);
    if(data?.length!==ids.length)throw new Error("Some selected invoices are unavailable or belong to another branch. Refresh and select them again.");
    for(const order of data){
      const date=order.order_date as string|null;
      if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("A selected invoice has no valid order date. Refresh and review it.");
      if((filters.startDate&&date<filters.startDate)||(filters.endDate&&date>filters.endDate))throw new Error("A selected invoice is outside your date filters. Refresh and select it again.");
      if(!startDate||date<startDate)startDate=date;
      if(!endDate||date>endDate)endDate=date;
    }
  }
  const {data,error}=await supabase.rpc("create_weekly_invoice",{
    p_location_id:filters.branchId,p_start_date:startDate,p_end_date:endDate,p_order_ids:orderIds,
  });
  if(error)throw new Error(error.message);
  if(!data)throw new Error("Unable to create invoice.");
  return data;
}
