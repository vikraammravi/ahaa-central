"use client";
import {use} from "react";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import {BackLink} from "@/components/shared/BackLink";
import {InvoiceDetail} from "@/components/shared/InvoiceDetail";
export default function Page({params}:{params:Promise<{id:string}>}){const {id}=use(params);return <div className="max-w-[1200px] mx-auto space-y-4"><div className="flex flex-wrap gap-2"><BackLink href="/admin/invoices">Back to Individual Orders</BackLink><Button asChild variant="outline" size="sm"><Link href={`/admin/orders/${id}`}>View Branch Order</Link></Button></div><InvoiceDetail orderId={id} isAdmin/></div>;}
