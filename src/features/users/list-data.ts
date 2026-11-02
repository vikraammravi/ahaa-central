import { supabase } from "@/lib/supabase/client";
import { pageRange, lastPage, searchFilter } from "@/lib/pagination";
import type {Profile, ProfileStatus} from "@/lib/supabase/types";
export async function fetchUsers(filters: {page:number;search:string;branchId?:string;status?:ProfileStatus|""}, signal: AbortSignal): Promise<{ profiles: Profile[]; count:number; page:number }> {
  let query = supabase.from("profiles").select("*", {count:"exact"}).order("full_name").order("id");
  if(filters.search.trim()) query = query.or(searchFilter(["full_name", "email"], filters.search));
  if(filters.branchId) query = query.eq("location_id", filters.branchId);
  if(filters.status) query = query.eq("status", filters.status);
  const result = await query.range(...pageRange(filters.page)).abortSignal(signal);
  if (result.error) throw new Error(result.error.message);
  const count = result.count ?? 0;
  if(filters.page > lastPage(count)) return fetchUsers({...filters,page:lastPage(count)},signal);
  return { profiles: (result.data ?? []) as Profile[], count, page:filters.page };
}
