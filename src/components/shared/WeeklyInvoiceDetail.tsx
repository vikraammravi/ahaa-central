"use client";
import { useCallback,useState } from "react";
import Link from "next/link";
import { useAsyncData } from "@/lib/useAsyncData";
import { supabase } from "@/lib/supabase/client";
import { Card,CardHeader,CardTitle,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "./Banner";
import { LoadingState } from "./Spinner";
import { DataTable,type Column } from "./DataTable";
import { InvoiceTotals } from "./InvoiceTotals";
import { formatMoney,formatDate,taxLabel } from "@/lib/format";
import { weeklyNumber } from "@/lib/weekly";
import type { WeeklyInvoiceDetails } from "@/lib/supabase/types";

export function WeeklyInvoiceDetail({invoiceId,isAdmin=false}:{invoiceId:string;isAdmin?:boolean}){
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const load=useCallback(async(signal:AbortSignal)=>{
    const [details,record,history]=await Promise.all([
      supabase.rpc("weekly_invoice_details",{p_invoice_id:invoiceId,p_live:isAdmin}).abortSignal(signal),
      supabase.from("weekly_invoices").select("revision,sent_revision,sent_at").eq("id",invoiceId).abortSignal(signal).single(),
      supabase.from("weekly_invoice_publications").select("revision,published_at").eq("weekly_invoice_id",invoiceId).order("revision",{ascending:false}).abortSignal(signal),
    ]);
    if(details.error||record.error||history.error)throw new Error(details.error?.message??record.error?.message??history.error?.message);
    return {invoice:details.data as WeeklyInvoiceDetails,record:record.data as {revision:number;sent_revision:number|null;sent_at:string|null},history:(history.data??[]) as {revision:number;published_at:string}[]};
  },[invoiceId,isAdmin]);
  const {data,loading,error:loadError,refresh}=useAsyncData(load);
  async function send(){setBusy(true);setError(null);try{const {error}=await supabase.rpc("send_weekly_invoice",{p_invoice_id:invoiceId});if(error)throw new Error(error.message);await refresh();}catch(error){setError(error instanceof Error?error.message:"Unable to send invoice.");}finally{setBusy(false);}}
  if(loading)return <LoadingState label="Loading weekly invoice…"/>;
  if(!data)return <Banner tone="danger">{loadError??"Invoice unavailable."}</Banner>;
  const invoice=data.invoice;const sent=data.record?.sent_revision===data.record?.revision;
  const columns:Column<WeeklyInvoiceDetails["lines"][number]>[]=[
    {key:"item",header:"Item",className:"whitespace-normal",render:(line)=><div>{line.name}<div className="text-xs text-muted-foreground">{line.unit_type}</div></div>},
    {key:"qty",header:"Quantity",align:"right",render:(line)=>line.quantity},
    {key:"price",header:"Unit Price",align:"right",render:(line)=>formatMoney(line.unit_price)},
    {key:"tax",header:"Tax",render:(line)=>taxLabel(line.is_taxable)},
    {key:"subtotal",header:"Subtotal",align:"right",render:(line)=>formatMoney(line.subtotal)},
  ];
  return <div className="space-y-4">{(error||loadError)&&<Banner tone="danger">{error||loadError}</Banner>}<Card><CardHeader className="flex flex-col sm:flex-row sm:justify-between gap-3"><div><CardTitle>{weeklyNumber(invoice.id)}</CardTitle><p className="mt-2 text-sm text-muted-foreground">{invoice.branch_name} · {formatDate(invoice.start_date)} – {formatDate(invoice.end_date)}</p></div>{isAdmin&&<Button disabled={busy||sent} onClick={send}>{sent?"Sent":busy?"Sending…":data.record?.sent_at?"Send Updated Weekly Invoice":"Send Weekly Invoice"}</Button>}</CardHeader></Card>
    {isAdmin&&<Banner tone="info">Review the included orders below. Quantity and tax corrections are made on each individual invoice; unit prices are locked. {data.record?.sent_at&&!sent&&"The branch sees the previous version until this update is sent."}</Banner>}
    <DataTable data={invoice.lines} columns={columns} rowKey={(line,index)=>`${line.item_id}-${index}`} emptyTitle="No invoice items"/>
    <InvoiceTotals subtotal={invoice.subtotal} tax={invoice.tax} total={invoice.total}/>
    <Card><CardHeader><CardTitle className="text-base">Included Orders ({invoice.orders.length})</CardTitle></CardHeader><CardContent className="divide-y">{invoice.orders.map((order)=><div key={order.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><Link className="text-saffron-hover underline" href={isAdmin?`/admin/invoices/${order.id}`:`/branch/invoices/${order.id}`}>Order #{order.order_number} · {formatDate(order.order_date)}</Link><span>{formatMoney(order.total)}</span></div>)}</CardContent></Card>
    {data.history.length>0&&<Card><CardHeader><CardTitle className="text-base">Sent Versions</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{data.history.map((entry)=><p key={entry.revision}>Revision {entry.revision} · sent {formatDate(entry.published_at)}</p>)}</CardContent></Card>}
  </div>;
}
