"use client";

import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { NotesPreview } from "@/components/shared/NotesPreview";
import { CATERING_STATUS_BADGE, CATERING_STATUS_LABEL, phoneHref, whatsappHref } from "@/lib/catering";
import { formatDate, formatTime, formatDateTime } from "@/lib/format";
import type { CateringEvent } from "@/lib/supabase/types";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { RecordCards } from "@/components/shared/RecordCards";

const money = (amount: number) => `CA$${Number(amount).toFixed(2)}`;

export function CateringTable({ events, loading, onEdit, onDelete }: {
  events: CateringEvent[] | null;
  loading: boolean;
  onEdit: (event: CateringEvent) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const compact=useCompactLayout();
  const fulfillment=(event:CateringEvent)=><div className="space-y-1"><span>{event.fulfillment_method==="DELIVERY"?"Delivery":"Pickup"}</span>{event.fulfillment_method==="DELIVERY"&&event.delivery_address&&<NotesPreview preview={false} text={event.delivery_address} title={`Delivery address — ${event.customer_name}`} description={formatDateTime(event.event_datetime)} buttonLabel="View address" contentLabel="Full delivery address" buttonClassName={compact?"h-11":undefined}/>}</div>;
  const notes=(event:CateringEvent)=>event.notes?<NotesPreview preview={false} buttonClassName={compact?"mt-0 h-11":undefined} text={event.notes} title={`Notes — ${event.customer_name}`} description={formatDateTime(event.event_datetime)}/>:<span className="text-muted-foreground">—</span>;
  const contacts=(event:CateringEvent)=>{
    const href=phoneHref(event.customer_phone),whatsapp=whatsappHref(event.customer_phone);
    return <>
      {href?<Button asChild variant="outline" size="icon" className="size-11 lg:size-9"><a href={href} aria-label={`Call ${event.customer_name}`} title={`Call ${event.customer_phone}`}><Phone className="size-4"/></a></Button>:<Button variant="outline" size="icon" className="size-11 lg:size-9" disabled aria-label="No valid phone number"><Phone className="size-4"/></Button>}
      {whatsapp?<Button asChild variant="outline" size="icon" className="size-11 lg:size-9 text-green-700"><a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${event.customer_name}`} title="Open WhatsApp chat"><MessageCircle className="size-4"/></a></Button>:<Button variant="outline" size="icon" className="size-11 lg:size-9" disabled aria-label="WhatsApp needs a valid international or Canadian phone number"><MessageCircle className="size-4"/></Button>}

    </>;
  };
  const editActions=(event:CateringEvent)=><RowActions onEdit={()=>onEdit(event)} onDelete={()=>onDelete(event.id)} deleteTitle={`Delete ${event.customer_name}'s event?`} deleteDescription="This catering booking will be permanently removed."/>;
  const actions=(event:CateringEvent)=><div className="flex items-center justify-end gap-2">{contacts(event)}{editActions(event)}</div>;
  const columns: Column<CateringEvent>[] = [
    {
      key: "customer", header: "Customer / Event", className: "w-[34%] whitespace-normal break-words px-2 md:w-auto md:px-4",
      render: (event) => <div className="space-y-1 min-w-0">
        <div className="text-base font-medium text-forest break-words">{event.customer_name}</div>
        {Array.isArray(event.checklist) && event.checklist.length > 0 && <div className="text-xs text-muted-foreground">Prep: {event.checklist.filter((task) => task && typeof task === "object" && !Array.isArray(task) && task.done === true).length} / {event.checklist.length} tasks</div>}
        <div className="text-xs text-muted-foreground md:hidden">{formatDate(event.event_datetime)}<br />{formatTime(event.event_datetime)} · {event.guest_count} guests</div>
      </div>,
    },
    { key: "date", header: "Date / Time", hideOn: "md", render: (event) => <div>{formatDate(event.event_datetime)}<div className="text-xs text-muted-foreground">{formatTime(event.event_datetime)}</div></div> },
    { key: "guests", header: "Guests", align: "right", hideOn: "md", render: (event) => event.guest_count },
    {key:"fulfillment",header:"Pickup / Delivery",className:"whitespace-normal",render:fulfillment},
    { key: "total", header: "Total", align: "right", hideOn: "md", render: (event) => money(event.total_amount) },
    { key: "advance", header: "Advance", align: "right", hideOn: "md", render: (event) => money(event.advance_paid) },
    { key: "balance", header: "Balance", align: "right", hideOn: "md", render: (event) => <span className={Number(event.balance_due) > 0 ? "text-saffron-hover" : "text-muted-foreground"}>{money(event.balance_due)}</span> },
    {
      key: "status", header: "Status", className: "w-[26%] whitespace-normal px-2 md:w-auto md:px-4",
      render: (event) => <div className="space-y-2"><StatusBadge status={CATERING_STATUS_BADGE[event.status]} label={CATERING_STATUS_LABEL[event.status]} />
        <div className="space-y-1 text-xs md:hidden"><div>{money(event.total_amount)}</div><div className="text-muted-foreground">Paid {money(event.advance_paid)}</div><div className={Number(event.balance_due) > 0 ? "text-saffron-hover" : "text-muted-foreground"}>Due {money(event.balance_due)}</div></div>
      </div>,
    },
    {key:"notes",header:"Notes",className:"w-[24%] px-2 md:w-auto md:px-4",render:notes},
    {
      key: "actions", header: "Actions", align: "right", className: "w-[16%] px-2 md:w-auto md:px-4",
      render:actions,
    },
  ];
  if(compact)return <RecordCards data={events} loading={loading} rowKey={event=>event.id} emptyTitle="No matching catering events" emptyBody="Add a booking or adjust your search and status filter.">{event=><>
    <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-base font-medium">{event.customer_name}</h3><StatusBadge status={CATERING_STATUS_BADGE[event.status]} label={CATERING_STATUS_LABEL[event.status]}/></div>
    <p className="text-sm">{formatDate(event.event_datetime)} · {formatTime(event.event_datetime)}</p><p className="text-xs text-muted-foreground">{event.guest_count} guests</p>
    <div className="text-sm">{fulfillment(event)}</div>
    <dl className="grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Total</dt><dd>{money(event.total_amount)}</dd></div><div><dt className="text-xs text-muted-foreground">Advance</dt><dd>{money(event.advance_paid)}</dd></div><div><dt className="text-xs text-muted-foreground">Balance</dt><dd>{money(event.balance_due)}</dd></div></dl>
    {Array.isArray(event.checklist)&&event.checklist.length>0&&<p className="text-xs text-muted-foreground">Prep: {event.checklist.filter(task=>task&&typeof task==="object"&&!Array.isArray(task)&&task.done===true).length} / {event.checklist.length} tasks</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">{notes(event)}<div className="ml-auto flex shrink-0 items-center gap-1">{contacts(event)}{editActions(event)}</div></div>
  </>}</RecordCards>;
  return <DataTable data={events} columns={columns} loading={loading} rowKey={(event) => event.id} tableClassName="min-w-[440px] table-fixed md:table-auto" emptyTitle="No matching catering events" emptyBody="Add a booking or adjust your search and status filter." />;
}

