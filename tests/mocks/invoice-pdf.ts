import type {InvoicePdfData} from "@/lib/invoice-pdf";
import {branch,combinedInvoice,invoiceLine,order,profile} from "./fixtures";
export const pdfId="12345678-1234-1234-1234-123456789012";
export const pdfProfile={...profile,role:"CENTRAL_ADMIN",status:"active"};
export const pdfOrder={...order,id:pdfId,locations:branch,order_lines:[invoiceLine],final_subtotal:50,final_tax_amount:0,final_total_amount:50};
export const pdfCombinedRecord={id:pdfId,location_id:branch.id,revision:0,sent_revision:0,sent_at:"2026-10-25T15:00:00Z",created_at:"2026-10-24T15:00:00Z",payment_status:"UNPAID",payment_revision:null as number|null,locations:branch};
export const pdfSnapshot={...combinedInvoice,id:pdfId,sent_at:pdfCombinedRecord.sent_at};
export const pdfPreview:InvoicePdfData={
  number:"INV-1107",date:"2026-10-23",branch:{name:"AAHA OSHAWA",address:"1180 Simcoe St N, Oshawa ON L1G 4W8"},
  lines:[{name:"Idly batter",unit:"Bucket",quantity:10,price:50,taxable:true,subtotal:500},{name:"Dosa batter",unit:"Bucket",quantity:13,price:63,taxable:true,subtotal:819}],
  subtotal:1319,tax:171.47,total:1490.47,draft:false,payment:"UNPAID",
};
