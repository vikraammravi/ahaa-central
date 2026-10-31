import {supabase} from "@/lib/supabase/client";
export type BranchStockItem={id:string;name:string;category:string;unit_type:string;central_stock:number;branch_stock:Record<string,number|null>};
export type BranchStockOverview={rows:BranchStockItem[];branches:{id:string;name:string}[];categories:string[];count:number;page:number;as_of:string};
export async function fetchBranchStock(filters:{page:number;search:string;category:string;branchId:string},signal:AbortSignal):Promise<BranchStockOverview>{
  const {data,error}=await supabase.rpc("admin_branch_stock",{p_page:filters.page,p_search:filters.search,p_category:filters.category,p_branch_id:filters.branchId||null}).abortSignal(signal);
  if(error)throw new Error(error.message);
  return data as BranchStockOverview;
}
