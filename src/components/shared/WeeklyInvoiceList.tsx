"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAsyncData } from "@/lib/useAsyncData";
import { DataTable, type Column } from "./DataTable";
import { Banner } from "./Banner";
import { Pagination } from "./Pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { PAGE_SIZE } from "@/lib/admin/data";
import { formatDate, formatMoney, POLL_INTERVAL } from "@/lib/format";
import { weeklyNumber, type InvoiceFilters } from "@/lib/weekly";
import type { WeeklyInvoice, WeeklyInvoiceDetails } from "@/lib/supabase/types";

type InvoiceRow = WeeklyInvoice & { weekly_invoice_publications?: {revision:number;snapshot:WeeklyInvoiceDetails}[] };

export function WeeklyInvoiceList({ filters, mode, isAdmin = true }: { filters: InvoiceFilters; mode: "all" | "sent"; isAdmin?: boolean }) {
  const [sending,setSending]=useState<string|null>(null);
  const [sendError,setSendError]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const load=useCallback(async(signal:AbortSignal)=>{
    let query=supabase.from("weekly_invoices").select(isAdmin ? "*, locations(name), orders(id)" : "*, locations(name), orders(id), weekly_invoice_publications(revision,snapshot)",{count:"exact"}).order("created_at",{ascending:false}).order("id");
    if(mode==="sent") query=query.not("sent_at","is",null);
    if(filters.branchId)query=query.eq("location_id",filters.branchId);
    if(filters.startDate)query=query.gte("end_date",filters.startDate);
    if(filters.endDate)query=query.lte("start_date",filters.endDate);
    const {data,error,count}=await query.range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1).abortSignal(signal);
    if(error)throw new Error(error.message);
    return {rows:(data??[]) as unknown as InvoiceRow[],count:count??0};
  },[filters.branchId,filters.startDate,filters.endDate,mode,page,isAdmin]);
  const {data,loading,error,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
  async function send(id:string){setSending(id);setSendError(null);try{const {error}=await supabase.rpc("send_weekly_invoice",{p_invoice_id:id});if(error)throw new Error(error.message);await refresh(true);}catch(error){setSendError(error instanceof Error?error.message:"Unable to send invoice.");}finally{setSending(null);}}
  const columns:Column<InvoiceRow>[]=[
    {key:"number",header:"Invoice",render:(invoice)=><Link className="font-medium underline-offset-4 hover:underline" href={`${isAdmin?"/admin":"/branch"}/invoices/weekly/${invoice.id}`}>{weeklyNumber(invoice.id)}</Link>},
    ...(isAdmin ? [{key:"branch",header:"Branch",render:(invoice:InvoiceRow)=>invoice.locations?.name??"Branch"}] : []),
    {key:"dates",header:"Period",className:"whitespace-normal",render:(invoice)=><span>{formatDate(invoice.start_date)} – {formatDate(invoice.end_date)}</span>},
    {key:"orders",header:"Orders",align:"right",render:(invoice)=>invoice.orders?.length??0},
    ...(!isAdmin ? [{key:"total",header:"Total",align:"right" as const,render:(invoice:InvoiceRow)=>{const publication=invoice.weekly_invoice_publications?.slice().sort((a,b)=>b.revision-a.revision)[0];return formatMoney(publication?.snapshot.total??0);}}] : []),
    {key:"status",header:"Status",render:(invoice)=><StatusBadge status={!isAdmin||invoice.sent_revision===invoice.revision?"completed":"pending"} label={invoice.sent_at?(!isAdmin||invoice.sent_revision===invoice.revision?"Sent":"Update Not Sent"):"Not Sent"}/>},
    ...(!isAdmin ? [{key:"view",header:"",render:(invoice:InvoiceRow)=><Button asChild size="sm" variant="outline"><Link href={`/branch/invoices/weekly/${invoice.id}`}>View Invoice</Link></Button>}] : []),
    ...(isAdmin ? [{key:"actions",header:"Actions",render:(invoice:WeeklyInvoice)=><div className="flex gap-2 items-center"><Button asChild size="sm" variant="outline"><Link href={`/admin/invoices/weekly/${invoice.id}`}>View</Link></Button><Button size="sm" variant={invoice.needs_sending?"default":"outline"} disabled={sending!==null||!invoice.needs_sending} onClick={()=>send(invoice.id)}>{sending===invoice.id?"Sending…":invoice.needs_sending?(invoice.sent_at?"Send Update":"Send"):"Sent"}</Button></div>}] : []),
  ];
  return <div className="space-y-3">{(error||sendError)&&<Banner tone="danger">{error||sendError}</Banner>}<DataTable data={data?.rows??null} columns={columns} loading={loading} rowKey={(invoice)=>invoice.id} rowClassName={(invoice)=>isAdmin&&!invoice.needs_sending?"bg-muted/70 text-muted-foreground":undefined} emptyTitle={isAdmin?"No combined invoices yet":"No invoices sent yet"}/><Pagination page={page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/></div>;
}
