import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, Location, Order, OrderStatus, Profile } from "@/lib/supabase/types";
import { pageRange, lastPage, searchFilter } from "@/lib/pagination";
export { PAGE_SIZE } from "@/lib/pagination";

export type OrderWithLocation = Order & { locations: { name: string } | null; pickup_requests: { return_status: string | null; status: string; requested_at: string }[] };

export async function fetchCatalog(signal: AbortSignal): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from("catalog_items").select("*").order("name").abortSignal(signal);
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogItem[];
}
export async function fetchLocations(signal: AbortSignal): Promise<Location[]> {
  const { data, error } = await supabase.from("locations").select("*").order("name").abortSignal(signal);
  if (error) throw new Error(error.message);
  return (data ?? []) as Location[];
}
export async function fetchUsers(filters: {page:number;search:string}, signal: AbortSignal): Promise<{ profiles: Profile[]; count:number; page:number }> {
  let query = supabase.from("profiles").select("*", {count:"exact"}).order("full_name").order("id");
  if(filters.search.trim()) query = query.or(searchFilter(["full_name", "email"], filters.search));
  const result = await query.range(...pageRange(filters.page)).abortSignal(signal);
  if (result.error) throw new Error(result.error.message);
  const count = result.count ?? 0;
  if(filters.page > lastPage(count)) return fetchUsers({...filters,page:lastPage(count)},signal);
  return { profiles: (result.data ?? []) as Profile[], count, page:filters.page };
}
export type OrderFilters = { page: number; status: OrderStatus | "ALL" | "OPEN" | "BILLABLE"; startDate?: string; endDate?: string; branchId?: string };

export async function fetchOrders(filters: OrderFilters, signal: AbortSignal): Promise<{ rows: OrderWithLocation[]; count: number; page: number }> {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) return { rows: [], count: 0, page: 0 };
  let query = supabase.from("orders").select("*, locations(name), pickup_requests(return_status,status,requested_at)", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (filters.status === "OPEN") query = query.in("status", ["SUBMITTED", "PREPARING", "READY"]);
  else if (filters.status === "BILLABLE") query = query.eq("status", "COMPLETED").is("weekly_invoice_id", null);
  else if (filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.startDate) query = query.gte("order_date", filters.startDate);
  if (filters.endDate) query = query.lte("order_date", filters.endDate);
  if (filters.branchId) query = query.eq("location_id", filters.branchId);
  const result = await query.range(...pageRange(filters.page)).abortSignal(signal);
  if (result.error) throw new Error(result.error.message);
  if (filters.page > lastPage(result.count ?? 0)) return fetchOrders({ ...filters, page: lastPage(result.count ?? 0) }, signal);
  return { rows: (result.data ?? []) as OrderWithLocation[], count: result.count ?? 0, page: filters.page };
}

export type DashboardSummary = {
  ordersToday: number; pendingOrders: number; revenueToday: number; lowStock: number;
  recentOrders: OrderWithLocation[]; lowItems: CatalogItem[]; businessDate: string;
};
export async function fetchDashboard(signal: AbortSignal): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("admin_dashboard_summary").abortSignal(signal);
  if (error) throw new Error(error.message);
  return data as DashboardSummary;
}
