"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InvoiceDetail } from "@/components/shared/InvoiceDetail";

export default function BranchInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div className="max-w-[1000px] mx-auto space-y-4"><Link href={`/branch/invoices/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" />Back to kitchen order</Link><InvoiceDetail orderId={id} /></div>;
}
