import { InvoiceActions } from "@/features/billing/components/InvoiceActions";
import { formatDate, formatMoney } from "@/lib/format";
import type { WeeklyInvoiceDetails } from "@/lib/supabase/types";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableCell, TableRow } from "@/components/ui/table";

export function CombinedInvoiceOrders({ orders, isAdmin, canEdit = isAdmin }: {orders: WeeklyInvoiceDetails["orders"]; isAdmin: boolean; canEdit?: boolean}) {
  const columns: Column<WeeklyInvoiceDetails["orders"][number]>[] = [
    {key:"number", cardSpan:2,header:"Invoice",render:order=><span className="font-medium">INV-{order.order_number}</span>},
    {key:"date",header:"Date",render:order=>formatDate(order.order_date)},
    {key:"total",header:"Total",align:"right",render:order=>formatMoney(order.total)},
    ...(isAdmin?[{key:"actions",header:"Actions",render:(order:WeeklyInvoiceDetails["orders"][number])=><InvoiceActions id={order.id} kind="individual" edit={canEdit}/>}]:[]),
  ];
  return <div className="space-y-2"><p className="text-sm font-bold">Individual invoices ({orders.length})</p><DataTable wideCompact data={orders} columns={columns} rowKey={order=>order.id}/></div>;
}

/** Desktop breakdown shares the outer invoice table's columns and alignment. */
export function CombinedInvoiceOrderRows({orders, isAdmin, canEdit = isAdmin}: {orders: WeeklyInvoiceDetails["orders"]; isAdmin: boolean; canEdit?: boolean}) {
  const columnCount = isAdmin ? 10 : 9;
  return <>
    <TableRow className="bg-surface hover:bg-surface">
      <TableCell className="px-2"/>
      <TableCell colSpan={columnCount-2} className="px-2 py-2 text-sm font-bold 2xl:hidden">Individual invoices ({orders.length})</TableCell>
      <TableCell colSpan={columnCount-1} className="hidden px-2 py-2 text-sm font-bold 2xl:table-cell">Individual invoices ({orders.length})</TableCell>
    </TableRow>
    {orders.map(order=><TableRow key={order.id} className="bg-surface hover:bg-surface">
      <TableCell className="px-2"/>
      <TableCell className="px-2 font-medium">INV-{order.order_number}</TableCell>
      {isAdmin&&<TableCell className="px-2"/>}
      <TableCell className="px-2"><span className="block text-xs text-muted-foreground">Order date</span>{formatDate(order.order_date)}</TableCell>
      <TableCell className="px-2"/>
      <TableCell className="hidden px-2 2xl:table-cell"/>
      <TableCell className="px-2 text-right">{formatMoney(order.total)}</TableCell>
      <TableCell className="px-2"/>
      <TableCell className="px-2"/>
      <TableCell className="px-2" onClick={event=>event.stopPropagation()}>{isAdmin&&<InvoiceActions id={order.id} kind="individual" edit={canEdit}/>}</TableCell>
    </TableRow>)}
  </>;
}
