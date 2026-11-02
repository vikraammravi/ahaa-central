export type InvoicePdfLine = { name:string; unit:string; quantity:number; price:number; taxable:boolean; subtotal:number };
export type InvoicePdfData = {
  number:string; date:string; period?:{from:string;to:string}; branch:{name:string;address:string};
  lines:InvoicePdfLine[]; subtotal:number; tax:number; total:number;
  draft:boolean; payment?:"UNPAID"|"PAID"; paymentNeedsReview?:boolean;
  orders?:{number:number;date:string;total:number}[];
};
export type InvoicePdfKind = "individual" | "combined";
export function invoicePdfUrl(kind:InvoicePdfKind,id:string){return `/api/invoices/${kind}/${encodeURIComponent(id)}/pdf`;}
