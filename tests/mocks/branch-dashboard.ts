import type { BranchDashboardSummary } from "@/lib/branch-dashboard-data";
import { branch, order } from "./fixtures";
export const branchDashboard: BranchDashboardSummary = {
 branch: { id: branch.id, name: branch.name }, businessDate: "2026-10-12", todaysOrder: { final_total_amount: 50 }, pendingOrders: 2,
 recentOrders: [order], upcomingCateringCount: 7,
 upcomingCatering: [{ id: "event", customer_name: "Test customer", event_datetime: "2026-10-13T16:00:00Z", guest_count: 20, total_amount: 100 }],
};
