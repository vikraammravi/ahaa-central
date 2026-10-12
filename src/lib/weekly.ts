import type { Order } from "./supabase/types";
export type InvoiceFilters = { startDate: string; endDate: string; branchId: string };
export function eligibleForWeekly(order: Pick<Order, "status" | "weekly_invoice_id" | "pickup_approval_status"> & { pickup_requests?: { return_status: string | null }[] }): boolean {
  return order.status === "COMPLETED" && !order.weekly_invoice_id && order.pickup_approval_status !== "PENDING" && !order.pickup_requests?.some((request) => request.return_status === "PENDING");
}
export function weeklyNumber(id: string): string { return `WK-${id.slice(0,8).toUpperCase()}`; }

type WeeklyCandidate=Parameters<typeof eligibleForWeekly>[0]&{id:string};
export async function collectEligibleInvoiceIds(fetchPage:(page:number)=>Promise<{rows:WeeklyCandidate[];count:number}>,pageSize:number):Promise<Record<string,boolean>>{
 const selected:Record<string,boolean>={};
 for(let page=0;;page++){const result=await fetchPage(page);for(const order of result.rows)if(eligibleForWeekly(order))selected[order.id]=true;if(!result.rows.length||(page+1)*pageSize>=result.count)break;}
 return selected;
}
