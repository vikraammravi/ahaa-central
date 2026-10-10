"use client";

import { ReactNode, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { supabase } from "@/lib/supabase/client";
import { CATERING_STATUSES, CATERING_STATUS_LABEL, localDateInput, phoneHref } from "@/lib/catering";
import type { CateringEvent, CateringStatus } from "@/lib/supabase/types";

type Mode = "create" | "edit";

// Reusable create/edit dialog for a branch's catering event.
// Pass no `event` for create; pass one for edit.
export function CateringEventDialog({
  event,
  locationId,
  trigger,
  onSaved,
  open,
  onOpenChange,
}: {
  event?: CateringEvent;
  locationId: string | null;
  trigger?: ReactNode;
  onSaved?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const mode: Mode = event ? "edit" : "create";

  const [customerName, setCustomerName] = useState(event?.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(event?.customer_phone ?? "");
  const [guestCount, setGuestCount] = useState(event ? String(event.guest_count) : "");
  const [eventDate, setEventDate] = useState(event ? localDateInput(new Date(event.event_datetime)) : "");
  const [eventTime, setEventTime] = useState(event ? new Date(event.event_datetime).toTimeString().slice(0, 5) : "18:00");
  const [totalAmount, setTotalAmount] = useState(event ? String(event.total_amount) : "");
  const [advancePaid, setAdvancePaid] = useState(String(event?.advance_paid ?? 0));
  const [status, setStatus] = useState<CateringStatus>(event?.status ?? "INQUIRY");
  const [notes, setNotes] = useState(event?.notes ?? "");

  async function handleSubmit() {
    if (!locationId && mode === "create") {
      throw new Error("No branch assigned to your account");
    }
    const total = Number(totalAmount);
    const advance = Number(advancePaid);
    const guests = Number(guestCount);
    const datetime = new Date(`${eventDate}T${eventTime}:00`);
    if (!customerName.trim() || !phoneHref(customerPhone)) throw new Error("Enter a customer name and valid phone number.");
    if (!Number.isInteger(guests) || guests < 1) throw new Error("Guest count must be a whole number of at least one.");
    if (!eventDate || !eventTime || Number.isNaN(datetime.getTime())) throw new Error("Enter a valid event date and time.");
    if (!Number.isFinite(total) || !Number.isFinite(advance) || total < 0 || advance < 0 || advance > total) throw new Error("Advance paid must be between zero and the total amount.");
    const payload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      guest_count: guests,
      event_datetime: datetime.toISOString(),
      total_amount: total,
      advance_paid: advance,
      balance_due: Math.max(0, total - advance),
      status,
      notes: notes.trim() || null,
    };
    const { error } =
      mode === "edit"
        ? await supabase
            .from("catering_events")
            .update(payload)
            .eq("id", event!.id)
        : await supabase
            .from("catering_events")
            .insert({ ...payload, location_id: locationId! });
    if (error) throw new Error(error.message);
    if (mode === "create") {
      setCustomerName(""); setCustomerPhone(""); setGuestCount(""); setEventDate(""); setEventTime("18:00");
      setTotalAmount(""); setAdvancePaid("0"); setStatus("INQUIRY"); setNotes("");
    }
    onSaved?.();
  }

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size="lg">
            <Plus className="size-4" /> Add Event
          </Button>
        )
      }
      title={mode === "edit" ? "Edit Catering Event" : "New Catering Event"}
      description={
        mode === "edit"
          ? "Update this booking."
          : "Log a catering booking for your branch."
      }
      submitLabel={mode === "edit" ? "Save Changes" : "Create Event"}
      onSubmit={handleSubmit}
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Customer Name" htmlFor="cx-name" required>
          <Input
            id="cx-name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Nisha Patel"
            required
          />
        </FormField>
        <FormField label="Customer Phone" htmlFor="cx-phone" required>
          <Input
            id="cx-phone"
            type="tel"
            autoComplete="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="(416) 555-1234"
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Event Date" htmlFor="cx-date" required>
          <Input
            id="cx-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Event Time" htmlFor="cx-time" required>
          <Input
            id="cx-time"
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Guest Count" htmlFor="cx-guests" required>
          <Input
            id="cx-guests"
            type="number"
            min={1}
            step={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            required
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Total (CA$)" htmlFor="cx-total" required>
          <Input
            id="cx-total"
            type="number"
            step="0.01"
            min={0}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Advance Paid (CA$)" htmlFor="cx-advance">
          <Input
            id="cx-advance"
            type="number"
            step="0.01"
            min={0}
            value={advancePaid}
            onChange={(e) => setAdvancePaid(e.target.value)}
          />
        </FormField>
        <FormField label="Status" htmlFor="cx-status">
          <FormSelect<CateringStatus>
            id="cx-status"
            value={status}
            onChange={setStatus}
            options={CATERING_STATUSES.map((s) => ({ value: s, label: CATERING_STATUS_LABEL[s] }))}
          />
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="cx-notes">
        <textarea
          id="cx-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Menu, dietary requests, delivery details…"
        />
      </FormField>
    </FormDialog>
  );
}
