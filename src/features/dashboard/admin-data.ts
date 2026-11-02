import { supabase } from "@/lib/supabase/client";
import type {CatalogItem} from "@/lib/supabase/types";
import type {OrderWithLocation} from "@/features/orders/admin-data";
export type DashboardSummary = {
  ordersToday: number; pendingOrders: number; revenueToday: number; lowStock: number;
  recentOrders: OrderWithLocation[]; lowItems: CatalogItem[]; businessDate: string;
};
export async function fetchDashboard(signal: AbortSignal): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("admin_dashboard_summary").abortSignal(signal);
  if (error) throw new Error(error.message);
  return data as DashboardSummary;
}
