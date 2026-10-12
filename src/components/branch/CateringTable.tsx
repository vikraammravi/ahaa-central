"use client";

import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { CATERING_STATUS_BADGE, CATERING_STATUS_LABEL, phoneHref, whatsappHref } from "@/lib/catering";
import { formatDate, formatTime } from "@/lib/format";
import type { CateringEvent } from "@/lib/supabase/types";

const money = (amount: number) => `CA$${Number(amount).toFixed(2)}`;

export function CateringTable({ events, loading, onEdit, onDelete }: {
  events: CateringEvent[] | null;
  loading: boolean;
  onEdit: (event: CateringEvent) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const columns: Column<CateringEvent>[] = [
    {
      key: "customer", header: "Customer / Event", className: "w-[44%] whitespace-normal break-words px-2 md:w-auto md:px-4",
      render: (event) => <div className="space-y-1 min-w-0">
        <div className="font-medium text-forest break-words">{event.customer_name}</div>
        <div className="text-xs text-muted-foreground break-all">{event.customer_phone}</div>
        {Array.isArray(event.checklist) && event.checklist.length > 0 && <div className="text-xs text-muted-foreground">Prep: {event.checklist.filter((task) => task && typeof task === "object" && !Array.isArray(task) && task.done === true).length} / {event.checklist.length} tasks</div>}
        {event.notes && <div className="text-xs text-muted-foreground line-clamp-2 max-w-64">{event.notes}</div>}
        <div className="text-xs text-muted-foreground md:hidden">{formatDate(event.event_datetime)}<br />{formatTime(event.event_datetime)} · {event.guest_count} guests</div>
      </div>,
    },
    { key: "date", header: "Date / Time", hideOn: "md", render: (event) => <div>{formatDate(event.event_datetime)}<div className="text-xs text-muted-foreground">{formatTime(event.event_datetime)}</div></div> },
    { key: "guests", header: "Guests", align: "right", hideOn: "md", render: (event) => event.guest_count },
    { key: "total", header: "Total", align: "right", hideOn: "md", render: (event) => money(event.total_amount) },
    { key: "advance", header: "Advance", align: "right", hideOn: "md", render: (event) => money(event.advance_paid) },
    { key: "balance", header: "Balance", align: "right", hideOn: "md", render: (event) => <span className={Number(event.balance_due) > 0 ? "text-saffron-hover" : "text-muted-foreground"}>{money(event.balance_due)}</span> },
    {
      key: "status", header: "Status", className: "w-[36%] whitespace-normal px-2 md:w-auto md:px-4",
      render: (event) => <div className="space-y-2"><StatusBadge status={CATERING_STATUS_BADGE[event.status]} label={CATERING_STATUS_LABEL[event.status]} />
        <div className="space-y-1 text-xs md:hidden"><div>{money(event.total_amount)}</div><div className="text-muted-foreground">Paid {money(event.advance_paid)}</div><div className={Number(event.balance_due) > 0 ? "text-saffron-hover" : "text-muted-foreground"}>Due {money(event.balance_due)}</div></div>
      </div>,
    },
    {
      key: "actions", header: "Actions", align: "right", className: "w-[20%] px-2 md:w-auto md:px-4",
      render: (event) => {
        const href = phoneHref(event.customer_phone);
        const whatsapp = whatsappHref(event.customer_phone);
        return <div className="flex flex-col items-end gap-1 md:flex-row md:justify-end md:gap-2">
          {href ? <Button asChild variant="outline" size="icon" className="size-9"><a href={href} aria-label={`Call ${event.customer_name}`} title={`Call ${event.customer_phone}`}><Phone className="size-4" /></a></Button> : <Button variant="outline" size="icon" disabled aria-label="No valid phone number"><Phone className="size-4" /></Button>}
          {whatsapp?<Button asChild variant="outline" size="icon" className="size-9 text-green-700"><a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${event.customer_name}`} title="Open WhatsApp chat"><MessageCircle className="size-4"/></a></Button>:<Button variant="outline" size="icon" disabled aria-label="WhatsApp needs a valid international or Canadian phone number"><MessageCircle className="size-4"/></Button>}
          <RowActions onEdit={() => onEdit(event)} onDelete={() => onDelete(event.id)} deleteTitle={`Delete ${event.customer_name}'s event?`} deleteDescription="This catering booking will be permanently removed." />
        </div>;
      },
    },
  ];
  return <DataTable data={events} columns={columns} loading={loading} rowKey={(event) => event.id} tableClassName="table-fixed md:table-auto" emptyTitle="No matching catering events" emptyBody="Add a booking or adjust your search and status filter." />;
}

