import type {InvoicePdfData} from "@/features/billing/pdf-contract";
import {branch,combinedInvoice,invoiceLine,order,profile} from "./fixtures";
export const pdfId="12345678-1234-1234-1234-123456789012";
export const pdfProfile={...profile,role:"CENTRAL_ADMIN",status:"active"};
export const pdfOrder={...order,id:pdfId,locations:branch,order_lines:[invoiceLine],final_subtotal:50,final_tax_amount:0,final_total_amount:50};
export const pdfCombinedRecord={id:pdfId,location_id:branch.id,revision:0,sent_revision:0,sent_at:"2026-10-25T15:00:00Z",created_at:"2026-10-24T15:00:00Z",payment_status:"UNPAID",payment_revision:null as number|null,locations:branch};
export const pdfSnapshot={...combinedInvoice,id:pdfId,sent_at:pdfCombinedRecord.sent_at};
// Deliberately out of order, with case, natural-number and equal-name ties.
export const unsortedCombinedPdfSnapshot={
  ...pdfSnapshot,
  lines:[
    {...pdfSnapshot.lines[0],name:"Zucchini",quantity:1,unit_price:7,subtotal:7},
    {...pdfSnapshot.lines[0],name:"apple 10",quantity:2,unit_price:5,subtotal:10},
    {...pdfSnapshot.lines[0],name:"Apple 2",quantity:3,unit_price:4,subtotal:12},
    {...pdfSnapshot.lines[0],name:"apple 2",quantity:4,unit_price:3,subtotal:12},
    {...pdfSnapshot.lines[0],name:"Banana",quantity:5,unit_price:2,subtotal:10},
  ],
  subtotal:51,tax:0,total:51,
};
export const combinedPdfSnapshotWithMissingNames={
  ...unsortedCombinedPdfSnapshot,
  lines:[
    {...pdfSnapshot.lines[0],name:null as unknown as string,quantity:1,subtotal:5},
    {...pdfSnapshot.lines[0],name:"Banana",quantity:2,subtotal:10},
    {...pdfSnapshot.lines[0],name:undefined as unknown as string,quantity:3,subtotal:15},
  ],
};
export const pdfPreview:InvoicePdfData={
  number:"INV-1107",date:"2026-10-23",branch:{name:"AAHA OSHAWA",address:"1180 Simcoe St N, Oshawa ON L1G 4W8"},
  lines:[{name:"Idly batter",unit:"Bucket",quantity:10,price:50,taxable:true,subtotal:500},{name:"Dosa batter",unit:"Bucket",quantity:13,price:63,taxable:true,subtotal:819}],
  subtotal:1319,tax:171.47,total:1490.47,draft:false,payment:"UNPAID",
};
