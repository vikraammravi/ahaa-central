"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { InvoiceActions } from "./InvoiceActions";
import { fetchCombinedInvoices, sendCombinedInvoice, type InvoiceRow } from "@/lib/invoice-data";
import { CombinedInvoiceOrders } from "./CombinedInvoiceOrders";
import { useAsyncData } from "@/lib/useAsyncData";
import { DataTable, type Column } from "./DataTable";
import { Banner } from "./Banner";
import { Pagination } from "./Pagination";
import { InvoicePaymentBadge } from "./InvoicePaymentBadge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PAGE_SIZE } from "@/lib/admin/data";
import { formatDate, formatMoney, POLL_INTERVAL } from "@/lib/format";
import { invoiceSummaryOrders } from "@/lib/invoice-summary";
import { weeklyNumber, type InvoiceFilters } from "@/lib/weekly";
import type { WeeklyInvoice } from "@/lib/supabase/types";

export function WeeklyInvoiceList({ filters, mode, isAdmin = true }: { filters: InvoiceFilters; mode: "all" | "sent"; isAdmin?: boolean }) {
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [sending,setSending]=useState<string|null>(null);
  const [sendError,setSendError]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const {branchId,startDate,endDate}=filters;
  const load=useCallback(async(signal:AbortSignal)=>{
    return fetchCombinedInvoices({branchId,startDate,endDate},mode,isAdmin,page,signal);
  },[branchId,startDate,endDate,mode,page,isAdmin]);
  const {data,loading,error,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
  async function send(id:string){setSending(id);setSendError(null);try{await sendCombinedInvoice(id);await refresh(true);}catch(error){setSendError(error instanceof Error?error.message:"Unable to send invoice.");}finally{setSending(null);}}
  const columns:Column<InvoiceRow>[]=[
    {key:"expand",header:"",render:invoice=><Button size="sm" variant="ghost" aria-expanded={!!expanded[invoice.id]} aria-label={`${expanded[invoice.id]?"Hide":"Show"} orders for ${weeklyNumber(invoice.id)}`} onClick={event=>{event.stopPropagation();setExpanded(previous=>({...previous,[invoice.id]:!previous[invoice.id]}));}}>{expanded[invoice.id]?"▾":"▸"}</Button>},
    {key:"number", cardSpan:2 as const,header:"Invoice",render:(invoice)=><span className="font-medium">{weeklyNumber(invoice.id)}</span>},
    ...(isAdmin ? [{key:"branch",header:"Branch",render:(invoice:InvoiceRow)=>invoice.locations?.name??"Branch"}] : []),
    {key:"from",header:"From Date",render:(invoice)=>formatDate(invoice.start_date)},
    {key:"to",header:"To Date",render:(invoice)=>formatDate(invoice.end_date)},
    {key:"payment",header:"Payment",render:(invoice)=><InvoicePaymentBadge payment={invoice} revision={isAdmin?invoice.revision:invoice.sent_revision??invoice.revision}/>},
    {key:"orders",header:"Orders",align:"right",render:(invoice)=>invoiceSummaryOrders(invoice,isAdmin).length},
    {key:"total",header:"Total",align:"right",render:invoice=>formatMoney(invoiceSummaryOrders(invoice,isAdmin).reduce((sum,order)=>sum+order.total,0))},
    {key:"status",header:"Status",render:(invoice)=><StatusBadge status={!isAdmin||invoice.sent_revision===invoice.revision?"completed":"pending"} label={invoice.sent_at?(!isAdmin||invoice.sent_revision===invoice.revision?"Sent":"Update Not Sent"):"Not Sent"}/>},
    ...(!isAdmin ? [{key:"view",header:"",render:(invoice:InvoiceRow)=><InvoiceActions id={invoice.id} kind="combined"/>}] : []),
    ...(isAdmin ? [{key:"actions", cardSpan:2 as const,header:"Actions",render:(invoice:WeeklyInvoice)=><div className="flex flex-wrap gap-2 items-center" onClick={event=>event.stopPropagation()}><InvoiceActions id={invoice.id} kind="combined"/><Button asChild size="sm" variant="outline"><Link onClick={event=>event.stopPropagation()} href={`/admin/invoices/weekly/${invoice.id}`}>Details</Link></Button><Button size="sm" variant={invoice.needs_sending?"default":"outline"} disabled={sending!==null||!invoice.needs_sending} onClick={()=>send(invoice.id)}>{sending===invoice.id?"Sending…":invoice.needs_sending?(invoice.sent_at?"Send Update":"Send"):"Sent"}</Button></div>}] : []),
  ];
  return <div className="space-y-3">{(error||sendError)&&<Banner tone="danger">{error||sendError}</Banner>}<DataTable showRowAction={false} data={data?.rows??null} columns={columns} loading={loading} rowKey={(invoice)=>invoice.id} onRowClick={invoice=>setExpanded(previous=>({...previous,[invoice.id]:!previous[invoice.id]}))} expandedContent={invoice=>expanded[invoice.id]?<CombinedInvoiceOrders orders={invoiceSummaryOrders(invoice,isAdmin)} isAdmin={isAdmin}/>:null} rowClassName={(invoice)=>isAdmin&&!invoice.needs_sending?"bg-muted/70 text-muted-foreground":undefined} emptyTitle={isAdmin?"No combined invoices yet":"No invoices sent yet"}/><Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/></div>;
}
