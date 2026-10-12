import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import type { WeeklyInvoiceDetails } from "@/lib/supabase/types";
import { DataTable, type Column } from "./DataTable";

export function CombinedInvoiceOrders({ orders, isAdmin }: {orders: WeeklyInvoiceDetails["orders"]; isAdmin: boolean}) {
  const base = isAdmin ? "/admin" : "/branch";
  const columns: Column<WeeklyInvoiceDetails["orders"][number]>[] = [
    {key:"number",header:"Invoice",render:order=><Link className="font-medium underline" href={`${base}/invoices/${order.id}`}>INV-{order.order_number}</Link>},
    {key:"date",header:"Date",render:order=>formatDate(order.order_date)},
    {key:"total",header:"Total",align:"right",render:order=>formatMoney(order.total)},
    {key:"view",header:"",render:order=><Button asChild size="sm" variant="outline"><Link href={`${base}/invoices/${order.id}`}>View</Link></Button>},
  ];
  return <div className="space-y-2"><p className="text-sm font-medium">Individual invoices ({orders.length})</p><DataTable data={orders} columns={columns} rowKey={order=>order.id}/></div>;
}
