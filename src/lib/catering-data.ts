import { supabase } from "./supabase/client";
import { lastPage, pageRange, searchFilter } from "./pagination";
import type { CateringEvent, CateringStatus } from "./supabase/types";
export type CateringFilters = {page:number;search:string;status:CateringStatus|"ALL"};
export async function fetchCatering(filters:CateringFilters,signal:AbortSignal):Promise<{rows:CateringEvent[];count:number;page:number}> {
  let query = supabase.from("catering_events").select("*",{count:"exact"}).order("event_datetime").order("id");
  if(filters.status!=="ALL") query=query.eq("status",filters.status);
  if(filters.search.trim()) query=query.or(searchFilter(["customer_name","customer_phone"],filters.search));
  const result=await query.range(...pageRange(filters.page)).abortSignal(signal);
  if(result.error) throw new Error(result.error.message);
  const count=result.count??0;
  if(filters.page>lastPage(count)) return fetchCatering({...filters,page:lastPage(count)},signal);
  return {rows:result.data??[],count,page:filters.page};
}
export async function deleteCatering(id:string):Promise<void> {
  const {error}=await supabase.from("catering_events").delete().eq("id",id);
  if(error) throw new Error(error.message);
}
