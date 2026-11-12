import { supabase } from "@/lib/supabase/client";
import { lastPage, pageRange } from "@/lib/pagination";
import { eligibleForWeekly, type InvoiceFilters } from "@/features/billing/combined";
import type { Order, WeeklyInvoice, WeeklyInvoiceDetails } from "@/lib/supabase/types";

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
export async function undoCombinedInvoice(id:string):Promise<void>{
  const {error}=await supabase.rpc("undo_combined_invoice",{p_invoice_id:id});
  if(error)throw new Error(error.message);
}

async function selectedInvoiceRows<T extends { id: string; order_date: string }>(filters: InvoiceFilters, orderIds: string[], fields: string, signal?: AbortSignal): Promise<T[]> {
  if (!filters.branchId || (filters.startDate && filters.endDate && filters.startDate > filters.endDate) || !orderIds.length || new Set(orderIds).size!==orderIds.length) {
    throw new Error("Choose a branch and at least one invoice. Any date filters must be valid.");
  }
  const result: T[] = [];
  // Read selected IDs in bounded batches, including selections from other pages.
  for(let offset=0;offset<orderIds.length;offset+=100){
    const ids=orderIds.slice(offset,offset+100);
    let query = supabase.from("orders").select(fields).in("id",ids).eq("location_id",filters.branchId);
    if (signal) query = query.abortSignal(signal);
    const {data,error}=await query;
    if(error)throw new Error(error.message);
    if(data?.length!==ids.length)throw new Error("Some selected invoices are unavailable or belong to another branch. Refresh and select them again.");
    const rows = data as unknown as T[];
    if (new Set(rows.map(row => row.id)).size !== ids.length || rows.some(row => !ids.includes(row.id))) throw new Error("Some selected invoices are unavailable. Refresh and select them again.");
    for(const order of rows){
      const date=order.order_date as string|null;
      if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("A selected invoice has no valid order date. Refresh and review it.");
      if((filters.startDate&&date<filters.startDate)||(filters.endDate&&date>filters.endDate))throw new Error("A selected invoice is outside your date filters. Refresh and select it again.");
    }
    result.push(...rows);
  }
  return result;
}

export type CombinedInvoicePreviewOrder = Pick<Order, "id" | "order_number" | "order_date" | "updated_at" | "final_subtotal" | "final_tax_amount" | "final_total_amount">;
export type CombinedInvoicePreview = { orders: CombinedInvoicePreviewOrder[]; startDate: string; endDate: string; subtotal: number; tax: number; total: number };

export async function fetchCombinedInvoicePreview(filters: InvoiceFilters, orderIds: string[], signal?: AbortSignal): Promise<CombinedInvoicePreview> {
  type Candidate = CombinedInvoicePreviewOrder & Pick<Order, "status" | "weekly_invoice_id" | "pickup_approval_status"> & { pickup_requests: { return_status: string | null }[] };
  const rows = await selectedInvoiceRows<Candidate>(filters, orderIds, "id,order_number,order_date,updated_at,final_subtotal,final_tax_amount,final_total_amount,status,weekly_invoice_id,pickup_approval_status,pickup_requests(return_status)", signal);
  if (rows.some(row => !eligibleForWeekly(row))) throw new Error("Some selected invoices are no longer completed, settled and uncombined. Refresh and select them again.");
  const orders = rows.map(row => {
    const source = [row.final_subtotal, row.final_tax_amount, row.final_total_amount];
    const amounts = source.map(Number);
    if (source.some(value => value === null || value === undefined) || amounts.some(value => !Number.isFinite(value) || value < 0)) throw new Error("A selected invoice has invalid amounts. Review it before combining.");
    return { id: row.id, order_number: row.order_number, order_date: row.order_date, updated_at: row.updated_at, final_subtotal: amounts[0], final_tax_amount: amounts[1], final_total_amount: amounts[2] };
  }).sort((a,b) => a.order_date.localeCompare(b.order_date) || a.order_number-b.order_number || a.id.localeCompare(b.id));
  const centsTotal = (field: "final_subtotal" | "final_tax_amount" | "final_total_amount") => Math.round(orders.reduce((sum,order)=>sum+order[field],0)*100)/100;
  return { orders, startDate: orders[0].order_date, endDate: orders[orders.length-1].order_date, subtotal: centsTotal("final_subtotal"), tax: centsTotal("final_tax_amount"), total: centsTotal("final_total_amount") };
}

export async function createCombinedInvoice(filters: InvoiceFilters, orderIds: string[], preview: CombinedInvoicePreview): Promise<string> {
  const orders = await selectedInvoiceRows<{id:string;order_date:string}>(filters, orderIds, "id,order_date");
  const dates = orders.map(order=>order.order_date).sort();
  const {data,error}=await supabase.rpc("create_weekly_invoice_checked",{
    p_location_id:filters.branchId,p_start_date:dates[0],p_end_date:dates[dates.length-1],p_order_ids:orderIds,p_expected:preview.orders,
  });
  if(error)throw new Error(error.message);
  if(!data)throw new Error("Unable to create invoice.");
  return data;
}
