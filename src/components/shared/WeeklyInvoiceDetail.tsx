"use client";
import { useCallback,useState } from "react";

import { useAsyncData } from "@/lib/useAsyncData";
import { supabase } from "@/lib/supabase/client";
import { Card,CardHeader,CardTitle,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "./Banner";
import { LoadingState } from "./Spinner";
import { DataTable,type Column } from "./DataTable";
import { InvoicePaymentStatus } from "./InvoicePaymentStatus";
import type { InvoicePaymentRecord } from "@/lib/payments";
import { InvoiceActions } from "./InvoiceActions";
import { InvoiceTotals } from "./InvoiceTotals";
import { formatMoney,formatDate,taxLabel,POLL_INTERVAL } from "@/lib/format";
import { weeklyNumber } from "@/lib/weekly";
import type { WeeklyInvoiceDetails } from "@/lib/supabase/types";

export function WeeklyInvoiceDetail({invoiceId,isAdmin=false}:{invoiceId:string;isAdmin?:boolean}){
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const load=useCallback(async(signal:AbortSignal)=>{
    const [details,record]=await Promise.all([
      supabase.rpc("weekly_invoice_details",{p_invoice_id:invoiceId,p_live:isAdmin}).abortSignal(signal),
      supabase.from("weekly_invoices").select("revision,sent_revision,sent_at,payment_status,payment_updated_at,payment_updated_by,payment_updated_name,payment_revision").eq("id",invoiceId).abortSignal(signal).single(),
    ]);
    if(details.error||record.error)throw new Error(details.error?.message??record.error?.message);
    return {invoice:details.data as WeeklyInvoiceDetails,record:record.data as {revision:number;sent_revision:number|null;sent_at:string|null}&InvoicePaymentRecord};
  },[invoiceId,isAdmin]);
  const {data,loading,error:loadError,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
  async function send(){setBusy(true);setError(null);try{const {error}=await supabase.rpc("send_weekly_invoice",{p_invoice_id:invoiceId});if(error)throw new Error(error.message);await refresh();}catch(error){setError(error instanceof Error?error.message:"Unable to send invoice.");}finally{setBusy(false);}}
  if(loading)return <LoadingState label="Loading invoice…"/>;
  if(!data)return <Banner tone="danger">{loadError??"Invoice unavailable."}</Banner>;
  const invoice=data.invoice;const sent=data.record?.sent_revision===data.record?.revision;
  const columns:Column<WeeklyInvoiceDetails["lines"][number]>[]=[
    {key:"item", cardSpan:2,header:"Item",className:"whitespace-normal",render:(line)=><div>{line.name}<div className="text-xs text-muted-foreground">{line.unit_type}</div></div>},
    {key:"qty",header:"Quantity",align:"right",render:(line)=>line.quantity},
    {key:"price",header:"Unit Price",align:"right",render:(line)=>formatMoney(line.unit_price)},
    {key:"tax",header:"Tax",render:(line)=>taxLabel(line.is_taxable)},
    {key:"subtotal",header:"Subtotal",align:"right",render:(line)=>formatMoney(line.subtotal)},
  ];
  return <div className="space-y-4">{(error||loadError)&&<Banner tone="danger">{error||loadError}</Banner>}<Card><CardHeader className="flex flex-col sm:flex-row sm:justify-between gap-3"><div><CardTitle>{weeklyNumber(invoice.id)}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{invoice.branch_name}</p></div><div className="flex flex-wrap items-center gap-2"><InvoiceActions id={invoiceId} kind="combined"/>{isAdmin&&<Button disabled={busy||sent} onClick={send}>{sent?"Sent":busy?"Sending…":data.record?.sent_at?"Send Updated Invoice":"Send Invoice"}</Button>}</div></CardHeader><CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">From Date</p><p className="font-medium">{formatDate(invoice.start_date)}</p></div><div><p className="text-xs text-muted-foreground">To Date</p><p className="font-medium">{formatDate(invoice.end_date)}</p></div></div>
    <InvoicePaymentStatus embedded invoiceId={invoiceId} payment={data.record} revision={isAdmin?data.record.revision:data.record.sent_revision??invoice.revision} isAdmin={isAdmin} onUpdated={()=>refresh(true)}/>
    </CardContent></Card>
    {isAdmin&&<Banner tone="info">Expand this invoice in the invoice list to review its individual orders. Quantity and tax corrections are made on each individual invoice; unit prices are locked. {data.record?.sent_at&&!sent&&"The branch sees the previous version until this update is sent."}</Banner>}
    <DataTable data={invoice.lines} columns={columns} rowKey={(line,index)=>`${line.item_id}-${index}`} emptyTitle="No invoice items"/>
    <InvoiceTotals subtotal={invoice.subtotal} tax={invoice.tax} total={invoice.total}/>
  </div>;
}
