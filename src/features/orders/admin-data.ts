import { supabase } from "@/lib/supabase/client";
import {pageRange,lastPage} from "@/lib/pagination";
import type {Order,OrderStatus} from "@/lib/supabase/types";
export type OrderWithLocation = Order & { locations: { name: string } | null; pickup_requests: { return_status: string | null; status: string; requested_at: string }[] };

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
