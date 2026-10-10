"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Banner } from "@/components/shared/Banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CateringEventDialog } from "@/components/branch/CateringEventDialog";
import { CateringTable } from "@/components/branch/CateringTable";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CATERING_STATUSES, CATERING_STATUS_LABEL } from "@/lib/catering";
import type { CateringEvent, CateringStatus } from "@/lib/supabase/types";

export default function BranchCateringPage() {
  const { profile } = useCurrentUser();
  const locationId = profile?.location_id ?? null;
  const [events, setEvents] = useState<CateringEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CateringEvent | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CateringStatus | "ALL">("ALL");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("catering_events").select("*").order("event_datetime");
    if (error) setError(error.message);
    else { setEvents(data as CateringEvent[]); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("catering_events").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await load();
  }

  const filtered = useMemo(() => events?.filter((event) => {
    const term = search.trim().toLowerCase();
    return (status === "ALL" || event.status === status) &&
      (!term || event.customer_name.toLowerCase().includes(term) || event.customer_phone.includes(term));
  }) ?? null, [events, search, status]);

  return <div className="max-w-[1200px] mx-auto space-y-4 min-w-0">
    <PageHeader title="Catering" subtitle="Manage bookings, customer calls, and payments." actions={<CateringEventDialog locationId={locationId} onSaved={load} />} />
    {error && <Banner tone="danger">{error}</Banner>}
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
      <div className="space-y-1.5"><Label htmlFor="catering-search">Search customers</Label><Input id="catering-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or phone number" /></div>
      <div className="space-y-1.5"><Label htmlFor="catering-status">Status</Label><select id="catering-status" value={status} onChange={(event) => setStatus(event.target.value as CateringStatus | "ALL")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="ALL">All statuses</option>{CATERING_STATUSES.map((value) => <option key={value} value={value}>{CATERING_STATUS_LABEL[value]}</option>)}</select></div>
    </div>
    <CateringTable events={filtered} loading={loading} onEdit={setEditing} onDelete={handleDelete} />
    {editing && <CateringEventDialog key={editing.id} event={editing} locationId={locationId} open onOpenChange={(open) => !open && setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
  </div>;
}
