import { supabase } from "@/lib/supabase/client";

export const USAGE_HISTORY_PAGE_SIZE = 25;
export type InventoryUsage = {
  id: string;
  item_id: string;
  item_name: string;
  unit_type: string;
  used_quantity: number | null;
  count_date: string;
  submitted_name: string;
  submitted_at: string;
};
export type UsageHistoryPage = { rows: InventoryUsage[]; total: number; page: number };
export type UsageHistoryFilters = { fromDate: string; toDate: string; search: string; page: number };

export async function fetchUsageHistory(filters: UsageHistoryFilters, signal: AbortSignal): Promise<UsageHistoryPage> {
  const { data, error } = await supabase.rpc("branch_inventory_usage_history", {
    p_from_date: filters.fromDate || null,
    p_to_date: filters.toDate || null,
    p_search: filters.search.trim(),
    p_page: filters.page,
  }).abortSignal(signal);
  if (error) throw new Error(error.message);
  return data as UsageHistoryPage;
}
