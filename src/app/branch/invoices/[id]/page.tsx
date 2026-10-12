"use client";

import { BackLink } from "@/components/shared/BackLink";
import { use } from "react";
import { OrderDetail } from "@/components/shared/OrderDetail";

export default function BranchOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      <BackLink href="/branch/invoices">Back to Orders</BackLink>
      <OrderDetail orderId={id} canEdit={false} />
    </div>
  );
}
