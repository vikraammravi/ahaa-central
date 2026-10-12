"use client";
import { useState } from "react";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoicePaymentBadge } from "./InvoicePaymentBadge";
import { Banner } from "./Banner";
import { supabase } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { paymentNeedsReview,type InvoicePaymentRecord } from "@/lib/payments";
export function InvoicePaymentStatus({invoiceId,payment,revision,isAdmin,onUpdated,embedded=false}:{invoiceId:string;payment:InvoicePaymentRecord;revision:number;isAdmin:boolean;onUpdated:()=>Promise<unknown>;embedded?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
 async function update(status:"PAID"|"UNPAID"){setBusy(true);setError(null);try{const {error}=await supabase.rpc("set_invoice_payment_status",{p_invoice_id:invoiceId,p_status:status,p_expected_updated_at:payment.payment_updated_at});if(error)throw new Error(error.message);await onUpdated();}catch(error){setError(error instanceof Error?error.message:"Unable to update payment status.");}finally{setBusy(false);}}
 const needsReview=paymentNeedsReview(payment,revision);
 const content=<><CardHeader className={embedded?"px-0 pt-0 flex flex-wrap flex-row justify-between gap-3":"flex flex-wrap flex-row justify-between gap-3"}><CardTitle className="text-base">Payment Status</CardTitle><InvoicePaymentBadge payment={payment} revision={revision}/></CardHeader><CardContent className={embedded?"px-0 pb-0 space-y-3 text-sm":"space-y-3 text-sm"}>{payment.payment_updated_at&&<p className="text-muted-foreground">Updated by {payment.payment_updated_name??"Central admin"} · {formatDateTime(payment.payment_updated_at)}</p>}{needsReview&&<Banner tone="warn">This invoice changed after it was marked Paid. Central admin should review and confirm its payment status.</Banner>}{error&&<Banner tone="danger">{error}</Banner>}{isAdmin&&<div className="flex flex-wrap gap-2">{needsReview&&<Button disabled={busy} onClick={()=>update("PAID")}>Confirm Paid</Button>}<Button variant={payment.payment_status==="PAID"?"outline":"default"} disabled={busy} onClick={()=>update(payment.payment_status==="PAID"?"UNPAID":"PAID")}>{busy?"Updating…":payment.payment_status==="PAID"?"Mark Unpaid":"Mark Paid"}</Button></div>}</CardContent></>;
 return embedded?<section className="border-t pt-4 space-y-3">{content}</section>:<Card>{content}</Card>;
}
