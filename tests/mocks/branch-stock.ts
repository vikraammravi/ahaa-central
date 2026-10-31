import type {BranchStockOverview} from "@/lib/admin/branch-stock";
import {branch,item} from "./fixtures";
export const branchStockOverview:BranchStockOverview={
  rows:[{id:item.id,name:item.name,category:item.category,unit_type:item.unit_type,central_stock:20,branch_stock:{[branch.id]:3,second:0}}],
  branches:[{id:branch.id,name:branch.name},{id:"second",name:"Whitby"}],categories:["Batter"],count:1,page:0,as_of:"2026-10-30T14:00:00Z",
};
