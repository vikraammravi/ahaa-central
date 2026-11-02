import { supabase } from "./supabase/client";
import type { Order, CateringEvent } from "./supabase/types";
export type BranchDashboardSummary = {
 branch: { id: string; name: string } | null; businessDate: string;
 todaysOrder: { final_total_amount: number } | null; pendingOrders: number;
 recentOrders: Pick<Order, "id" | "order_number" | "created_at" | "final_total_amount" | "status">[];
 upcomingCateringCount: number;
 upcomingCatering: Pick<CateringEvent, "id" | "customer_name" | "event_datetime" | "guest_count" | "total_amount">[];
};
export async function fetchBranchDashboard(signal: AbortSignal): Promise<BranchDashboardSummary> {
 const { data, error } = await supabase.rpc("branch_dashboard_summary").abortSignal(signal);
 if (error) throw new Error(error.message);
 return data as BranchDashboardSummary;
}
