import { order, branch } from "./fixtures";
import type { CombinedInvoicePreview } from "@/features/billing/data";

export const combineFilters={branchId:branch.id,startDate:"",endDate:""};
export const combineCandidates=[
  {...order,id:"earlier",order_number:11,order_date:"2026-10-01",final_subtotal:10,final_tax_amount:1.3,final_total_amount:11.3,pickup_requests:[]},
  {...order,id:"later",order_number:12,order_date:"2026-10-24",final_subtotal:20,final_tax_amount:2.6,final_total_amount:22.6,pickup_requests:[]},
];
export const combinePreview:CombinedInvoicePreview={
  orders:combineCandidates.map(({id,order_number,order_date,updated_at,final_subtotal,final_tax_amount,final_total_amount})=>({id,order_number,order_date,updated_at,final_subtotal,final_tax_amount,final_total_amount})),
  startDate:"2026-10-01",endDate:"2026-10-24",subtotal:30,tax:3.9,total:33.9,
};
export const manyCombineCandidates=Array.from({length:101},(_,index)=>({...combineCandidates[0],id:`selected-${index}`,order_number:index+1}));
