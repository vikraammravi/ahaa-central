"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvoiceActions } from "@/features/billing/components/InvoiceActions";
import { fetchCombinedInvoices, sendCombinedInvoice, undoCombinedInvoice, type InvoiceRow } from "@/features/billing/data";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pencil, Send, Trash2 } from "lucide-react";
import { CombinedInvoiceOrders, CombinedInvoiceOrderRows } from "@/features/billing/components/CombinedInvoiceOrders";
import { useAsyncData } from "@/lib/useAsyncData";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { Pagination } from "@/components/shared/Pagination";
import { InvoicePaymentBadge } from "@/features/billing/components/InvoicePaymentBadge";
import { InvoicePaymentStatus } from "@/features/billing/components/InvoicePaymentStatus";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatDate, formatMoney, POLL_INTERVAL } from "@/lib/format";
import { invoiceSummaryOrders } from "@/features/billing/summary";
import { weeklyNumber, type InvoiceFilters } from "@/features/billing/combined";
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
  async function undo(id:string){setSending(id);setSendError(null);try{await undoCombinedInvoice(id);await refresh(true);}catch(error){setSendError(error instanceof Error?error.message:"Unable to undo invoice.");}finally{setSending(null);}}
  function invoiceActions(invoice: WeeklyInvoice) {
    const canEdit = !invoice.sent_at;
    const canUndo = canEdit && invoice.payment_status !== "PAID";
    return <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap" onClick={event => event.stopPropagation()}>
      <InvoiceActions id={invoice.id} kind="combined"/>
      {canUndo && <ConfirmDialog
          trigger={<Button variant="outline" size="icon" className="size-11 lg:size-9 text-destructive" aria-label={`Undo ${weeklyNumber(invoice.id)}`} title="Undo combination" disabled={sending!==null}><Trash2 className="size-4"/></Button>}
          title="Undo combined invoice?" description="The individual invoices will be available to combine again."
          confirmLabel="Undo combination" onConfirm={() => undo(invoice.id)}
        />}
      {invoice.needs_sending ? <ConfirmDialog
        trigger={<Button variant="default" size="icon" className="size-11 lg:size-9" aria-label={`${invoice.sent_at?"Send update for":"Send"} ${weeklyNumber(invoice.id)}`} title={invoice.sent_at?"Send update":"Send invoice"} disabled={sending!==null}><Send className="size-4"/></Button>}
        title={invoice.sent_at?"Send updated invoice?":"Send invoice?"} description={`The branch will be able to view ${weeklyNumber(invoice.id)}.`}
        confirmLabel={invoice.sent_at?"Send update":"Send invoice"} tone="default" onConfirm={() => send(invoice.id)}
      /> : <Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label={`${weeklyNumber(invoice.id)} sent`} title="Sent" disabled><Send className="size-4"/></Button>}
    </div>;
  }
  const columns:Column<InvoiceRow>[]=[
    {key:"expand",header:"",render:invoice=><Button size="sm" variant="ghost" aria-expanded={!!expanded[invoice.id]} aria-label={`${expanded[invoice.id]?"Hide":"Show"} orders for ${weeklyNumber(invoice.id)}`} onClick={event=>{event.stopPropagation();setExpanded(previous=>({...previous,[invoice.id]:!previous[invoice.id]}));}}>{expanded[invoice.id]?"▾":"▸"}</Button>},
    {key:"number", cardSpan:2 as const,header:"Invoice",render:(invoice)=>{const count=invoiceSummaryOrders(invoice,isAdmin).length;return <div><span className="font-medium">{weeklyNumber(invoice.id)}</span><span className="hidden text-xs text-muted-foreground min-[1440px]:block 2xl:hidden">{count} {count===1?"order":"orders"}</span></div>;}},
    ...(isAdmin ? [{key:"branch",header:"Branch",render:(invoice:InvoiceRow)=><span className="block lg:max-w-32 lg:truncate" title={invoice.locations?.name??"Branch"}>{invoice.locations?.name??"Branch"}</span>}] : []),
    {key:"from",header:"From Date",render:(invoice)=>formatDate(invoice.start_date)},
    {key:"to",header:"To Date",render:(invoice)=>formatDate(invoice.end_date)},
    {key:"orders",header:"Orders",align:"right",className:"hidden 2xl:table-cell",render:(invoice)=>invoiceSummaryOrders(invoice,isAdmin).length},
    {key:"total",header:"Total",align:"right",render:invoice=>formatMoney(invoiceSummaryOrders(invoice,isAdmin).reduce((sum,order)=>sum+order.total,0))},
    {key:"status",header:"Status",render:(invoice)=><StatusBadge status={!isAdmin||invoice.sent_revision===invoice.revision?"completed":"pending"} label={invoice.sent_at?(!isAdmin||invoice.sent_revision===invoice.revision?"Sent":"Update Not Sent"):"Not Sent"}/>},
    {key:"payment",header:"Payment",className:"whitespace-normal",render:(invoice)=>isAdmin?<div className="flex flex-wrap items-center gap-x-1" onClick={event=>event.stopPropagation()}><div className="max-w-24"><InvoicePaymentBadge payment={invoice} revision={invoice.revision}/></div><Dialog><DialogTrigger asChild><Button variant="outline" size="icon" className="size-11 lg:size-9" aria-label={`Update payment for ${weeklyNumber(invoice.id)}`} title="Update payment status"><Pencil className="size-4" aria-hidden="true"/></Button></DialogTrigger><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Payment for {weeklyNumber(invoice.id)}</DialogTitle><DialogDescription>Review or update the payment status for this invoice.</DialogDescription></DialogHeader><InvoicePaymentStatus embedded invoiceId={invoice.id} payment={invoice} revision={invoice.revision} isAdmin onUpdated={()=>refresh(true)}/></DialogContent></Dialog></div>:<InvoicePaymentBadge payment={invoice} revision={invoice.sent_revision??invoice.revision}/>},
    ...(!isAdmin ? [{key:"view",header:"",render:(invoice:InvoiceRow)=><InvoiceActions id={invoice.id} kind="combined"/>}] : []),
    ...(isAdmin ? [{key:"actions", cardSpan:2 as const,header:"Actions",className:"lg:w-px lg:whitespace-nowrap",render:invoiceActions}] : []),
  ];
  return <div className="space-y-3">{(error||sendError)&&<Banner tone="danger">{error||sendError}</Banner>}<DataTable wideCompact showRowAction={false} tableClassName="[&_th]:px-2 [&_td]:px-2" data={data?.rows??null} columns={columns} loading={loading} rowKey={(invoice)=>invoice.id} onRowClick={invoice=>setExpanded(previous=>({...previous,[invoice.id]:!previous[invoice.id]}))} expandedContent={invoice=>expanded[invoice.id]?<CombinedInvoiceOrders orders={invoiceSummaryOrders(invoice,isAdmin)} isAdmin={isAdmin} canEdit={isAdmin&&!invoice.sent_at}/>:null} expandedRows={invoice=>expanded[invoice.id]?<CombinedInvoiceOrderRows orders={invoiceSummaryOrders(invoice,isAdmin)} isAdmin={isAdmin} canEdit={isAdmin&&!invoice.sent_at}/>:null} rowClassName={(invoice)=>isAdmin&&!invoice.needs_sending?"bg-muted/70 text-muted-foreground":undefined} emptyTitle={isAdmin?"No combined invoices yet":"No invoices sent yet"}/><Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/></div>;
}
