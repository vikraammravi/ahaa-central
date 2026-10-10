"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InvoiceDetail } from "@/components/shared/InvoiceDetail";

export default function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <div className="max-w-[1200px] mx-auto space-y-4"><Link href="/admin/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="size-4" />Back to invoices</Link><InvoiceDetail orderId={id} isAdmin /></div>;
}
