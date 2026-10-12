"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Banner } from "@/components/shared/Banner";
export default function BranchInvoicePage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const router=useRouter();const [error,setError]=useState<string|null>(null);
 useEffect(()=>{let active=true;void supabase.from("orders").select("weekly_invoice_id, weekly_invoices(sent_at)").eq("id",id).single().then(({data,error})=>{if(!active)return;const invoice=data?.weekly_invoices as unknown as {sent_at:string|null}|null;if(!error&&data?.weekly_invoice_id&&invoice?.sent_at)router.replace(`/branch/invoices/weekly/${data.weekly_invoice_id}`);else setError("The combined invoice has not been sent yet.");});return()=>{active=false;};},[id,router]);
 return <Banner tone="info">{error??"Opening invoice…"}</Banner>;
}
