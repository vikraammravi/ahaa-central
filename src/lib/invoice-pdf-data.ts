import type { createSupabaseServer } from "./supabase/server";
import type { InvoicePdfData,InvoicePdfKind } from "./invoice-pdf";
import type { WeeklyInvoiceDetails } from "./supabase/types";
import { paymentNeedsReview } from "./payments";
import { weeklyNumber } from "./weekly";
import { BUSINESS_TIME_ZONE } from "./format";

type Database = Awaited<ReturnType<typeof createSupabaseServer>>;
export class InvoicePdfError extends Error {
  constructor(message:string,public status:number){super(message);}
}
function address(location:{address?:string;city?:string;province?:string}|null){return [location?.address,location?.city,location?.province].filter(Boolean).join(", ");}
export async function loadInvoicePdf(db:Database,kind:InvoicePdfKind,id:string):Promise<InvoicePdfData>{
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw new InvoicePdfError("Please sign in to view this invoice.",401);
  const {data:profile,error:profileError}=await db.from("profiles").select("role,status,location_id").eq("id",user.id).single();
  if(profileError||!profile||profile.status!=="active"||!["CENTRAL_ADMIN","BRANCH_MANAGER"].includes(profile.role))throw new InvoicePdfError("You do not have invoice access.",403);
  const admin=profile.role==="CENTRAL_ADMIN";
  if(kind==="individual"){
    if(!admin)throw new InvoicePdfError("Individual invoices are available to central admin. View your sent combined invoice instead.",403);
    const {data:order,error}=await db.from("orders").select("*,locations(name,address,city,province),order_lines(*,catalog_items(name,unit_type))").eq("id",id).single();
    if(error||!order)throw new InvoicePdfError("Invoice not found.",404);
    if(!["READY","COMPLETED"].includes(order.status))throw new InvoicePdfError("This order is not ready for invoicing.",409);
    return {
      number:`INV-${order.order_number}`,date:order.order_date,branch:{name:order.locations?.name??"Branch",address:address(order.locations)},
      lines:(order.order_lines??[]).map((line:{invoice_quantity:number|null;fulfilled_quantity:number;unit_price:number;invoice_is_taxable:boolean|null;is_taxable:boolean;invoice_line_total:number;final_line_total:number;catalog_items:{name:string;unit_type:string}|null})=>({
        name:line.catalog_items?.name??"Item",unit:line.catalog_items?.unit_type??"",quantity:line.invoice_quantity??line.fulfilled_quantity,
        price:Number(line.unit_price),taxable:line.invoice_is_taxable??line.is_taxable,subtotal:Number(line.invoice_line_total??line.final_line_total),
      })),subtotal:Number(order.final_subtotal),tax:Number(order.final_tax_amount),total:Number(order.final_total_amount),draft:true,
    };
  }
  const {data:record,error}=await db.from("weekly_invoices").select("location_id,revision,sent_revision,sent_at,created_at,payment_status,payment_revision,locations(name,address,city,province)").eq("id",id).single();
  if(error||!record)throw new InvoicePdfError("Invoice not found.",404);
  if(!admin&&(record.location_id!==profile.location_id||!record.sent_at))throw new InvoicePdfError("Invoice not found.",404);
  const draft=admin&&(!record.sent_at||record.sent_revision!==record.revision);
  const {data,error:detailsError}=await db.rpc("weekly_invoice_details",{p_invoice_id:id,p_live:draft});
  if(detailsError||!data)throw new InvoicePdfError("Invoice could not be loaded.",404);
  const invoice=data as WeeklyInvoiceDetails;
  // Published snapshots provide branch name, amounts and line descriptions for sent invoices.
  const stamp=draft?record.created_at:invoice.sent_at??record.sent_at??record.created_at;
  const invoiceDate=new Intl.DateTimeFormat("en-CA",{timeZone:BUSINESS_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(stamp));
  const location=Array.isArray(record.locations)?record.locations[0]:record.locations;
  return {number:weeklyNumber(id),date:invoiceDate,
    period:{from:invoice.start_date,to:invoice.end_date},branch:{name:invoice.branch_name,address:address(location)},
    lines:invoice.lines.map(line=>({name:line.name,unit:line.unit_type,quantity:line.quantity,price:Number(line.unit_price),taxable:line.is_taxable,subtotal:Number(line.subtotal)})),
    subtotal:Number(invoice.subtotal),tax:Number(invoice.tax),total:Number(invoice.total),draft,
    payment:record.payment_status,paymentNeedsReview:paymentNeedsReview(record,invoice.revision),
    orders:invoice.orders.map(order=>({number:order.order_number,date:order.order_date,total:Number(order.total)})),
  };
}
