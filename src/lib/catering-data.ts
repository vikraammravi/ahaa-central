import { supabase } from "./supabase/client";
import { lastPage, pageRange, searchFilter } from "./pagination";
import type { CateringEvent, CateringStatus } from "./supabase/types";
import { businessDateKey, businessDayStart } from "./date-range";
export type CateringFilters = {page:number;search:string;status:CateringStatus|"ALL";locationId?:string;startDate?:string;endDate?:string};
export async function fetchCentralCateringLocation(signal:AbortSignal):Promise<string> {
  const {data,error}=await supabase.from("locations").select("id").eq("is_central",true).limit(2).abortSignal(signal);
  if(error)throw new Error(error.message);
  if(data?.length!==1)throw new Error("Set up one central-kitchen location in Branch List before adding central catering events.");
  return data[0].id;
}
export async function fetchCatering(filters:CateringFilters,signal:AbortSignal,asOf=new Date().toISOString()):Promise<{rows:CateringEvent[];count:number;page:number}> {
  if(filters.startDate&&filters.endDate&&filters.startDate>filters.endDate)return {rows:[],count:0,page:0};
  if(filters.locationId){
    const {error}=await supabase.from("catering_events").update({status:"COMPLETED",updated_at:asOf}).eq("location_id",filters.locationId).eq("status","CONFIRMED").lt("event_datetime",businessDayStart(businessDateKey(asOf))).abortSignal(signal);
    if(error)throw new Error(error.message);
  }
  let query = supabase.from("catering_events").select("*",{count:"exact"}).order("event_datetime",{ascending:filters.status!=="COMPLETED"}).order("id");
  if(filters.locationId)query=query.eq("location_id",filters.locationId);
  if(filters.status!=="ALL") query=query.eq("status",filters.status);
  if(filters.status==="CONFIRMED")query=query.gte("event_datetime",businessDayStart(businessDateKey(asOf))).neq("status","COMPLETED");
  if(filters.startDate)query=query.gte("event_datetime",businessDayStart(filters.startDate));
  if(filters.endDate)query=query.lt("event_datetime",businessDayStart(filters.endDate,true));
  if(filters.search.trim()) query=query.or(searchFilter(["customer_name","customer_phone"],filters.search));
  const result=await query.range(...pageRange(filters.page)).abortSignal(signal);
  if(result.error) throw new Error(result.error.message);
  const count=result.count??0;
  if(filters.page>lastPage(count)) return fetchCatering({...filters,page:lastPage(count)},signal,asOf);
  return {rows:result.data??[],count,page:filters.page};
}
export async function deleteCatering(id:string):Promise<void> {
  const {error}=await supabase.from("catering_events").delete().eq("id",id);
  if(error) throw new Error(error.message);
}
