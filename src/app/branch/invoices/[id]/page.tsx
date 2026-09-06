"use client";

import Link from "next/link";
import { use } from "react";
import { ChevronLeft } from "lucide-react";
import { OrderDetail } from "@/components/shared/OrderDetail";

export default function BranchOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      <Link
        href="/branch/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Back to orders
      </Link>
      <OrderDetail orderId={id} canEdit={false} />
    </div>
  );
}
