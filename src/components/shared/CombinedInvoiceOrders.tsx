import { InvoiceActions } from "./InvoiceActions";
import { formatDate, formatMoney } from "@/lib/format";
import type { WeeklyInvoiceDetails } from "@/lib/supabase/types";
import { DataTable, type Column } from "./DataTable";

export function CombinedInvoiceOrders({ orders, isAdmin }: {orders: WeeklyInvoiceDetails["orders"]; isAdmin: boolean}) {
  const columns: Column<WeeklyInvoiceDetails["orders"][number]>[] = [
    {key:"number", cardSpan:2,header:"Invoice",render:order=><span className="font-medium">INV-{order.order_number}</span>},
    {key:"date",header:"Date",render:order=>formatDate(order.order_date)},
    {key:"total",header:"Total",align:"right",render:order=>formatMoney(order.total)},
    ...(isAdmin?[{key:"actions",header:"Actions",render:(order:WeeklyInvoiceDetails["orders"][number])=><InvoiceActions id={order.id} kind="individual" edit/>}]:[]),
  ];
  return <div className="space-y-2"><p className="text-sm font-medium">Individual invoices ({orders.length})</p><DataTable data={orders} columns={columns} rowKey={order=>order.id}/></div>;
}
