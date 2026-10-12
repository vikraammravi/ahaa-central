"use client";
import {use} from "react";
import {BackLink} from "@/components/shared/BackLink";
import {WeeklyInvoiceDetail} from "@/components/shared/WeeklyInvoiceDetail";
export default function Page({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <div className="max-w-[1200px] mx-auto space-y-4"><BackLink href="/branch/invoices?tab=invoices">Back to Invoices</BackLink><WeeklyInvoiceDetail invoiceId={id} /></div>;}
