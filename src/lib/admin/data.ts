import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, Location, Order, OrderStatus, Profile } from "@/lib/supabase/types";

export type OrderWithLocation = Order & { locations: { name: string } | null; pickup_requests: { return_status: string | null }[] };
export type OrderCounts = Record<OrderStatus | "ALL", number>;
export const EMPTY_ORDER_COUNTS: OrderCounts = { ALL: 0, SUBMITTED: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 };
export const PAGE_SIZE = 25;

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
export async function fetchUsers(signal: AbortSignal): Promise<{ profiles: Profile[]; locations: Location[] }> {
  const [{ data, error }, locations] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name").abortSignal(signal), fetchLocations(signal),
  ]);
  if (error) throw new Error(error.message);
  return { profiles: (data ?? []) as Profile[], locations };
}
export type OrderFilters = { page: number; status: OrderStatus | "ALL" | "OPEN" | "BILLABLE"; startDate?: string; endDate?: string; branchId?: string };

export async function fetchOrders(filters: OrderFilters, signal: AbortSignal): Promise<{ rows: OrderWithLocation[]; count: number; counts: OrderCounts; page: number }> {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) return { rows: [], count: 0, counts: EMPTY_ORDER_COUNTS, page: 0 };
  let query = supabase.from("orders").select("*, locations(name), pickup_requests(return_status)", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (filters.status === "OPEN") query = query.in("status", ["SUBMITTED", "PREPARING", "READY"]);
  else if (filters.status === "BILLABLE") query = query.in("status", ["READY", "COMPLETED"]);
  else if (filters.status !== "ALL") query = query.eq("status", filters.status);
  if (filters.startDate) query = query.gte("order_date", filters.startDate);
  if (filters.endDate) query = query.lte("order_date", filters.endDate);
  if (filters.branchId) query = query.eq("location_id", filters.branchId);
  const [result, totals] = await Promise.all([
    query.range(filters.page * PAGE_SIZE, (filters.page + 1) * PAGE_SIZE - 1).abortSignal(signal),
    supabase.rpc("admin_order_counts", { p_start_date: filters.startDate || null, p_end_date: filters.endDate || null, p_location_id: filters.branchId || null }).abortSignal(signal),
  ]);
  if (result.error || totals.error) throw new Error(result.error?.message ?? totals.error?.message ?? "Unable to load orders.");
  if (filters.page > 0 && filters.page * PAGE_SIZE >= (result.count ?? 0)) return fetchOrders({ ...filters, page: Math.max(0, Math.ceil((result.count ?? 0) / PAGE_SIZE) - 1) }, signal);
  return { rows: (result.data ?? []) as OrderWithLocation[], count: result.count ?? 0, counts: { ...EMPTY_ORDER_COUNTS, ...totals.data }, page: filters.page };
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
