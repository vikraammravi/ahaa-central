"use client";

import { useEffect, useState } from "react";
import { Users, MapPin, Clock, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { LoadingState } from "@/components/shared/Spinner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CateringEventDialog } from "@/components/branch/CateringEventDialog";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CATERING_STATUS_BADGE, CATERING_STATUS_LABEL } from "@/lib/catering";
import type { CateringEvent } from "@/lib/supabase/types";

type ChecklistItem = { label: string; done?: boolean };

function checklistProgress(raw: unknown): { done: number; total: number } {
  if (!Array.isArray(raw)) return { done: 0, total: 0 };
  const items = raw as ChecklistItem[];
  return { done: items.filter((i) => i?.done).length, total: items.length };
}

export default function BranchCateringPage() {
  const { profile } = useCurrentUser();
  const locationId = profile?.location_id ?? null;
  const [events, setEvents] = useState<CateringEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CateringEvent | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    // RLS scopes events to this branch manager's location automatically.
    const { data, error } = await supabase
      .from("catering_events")
      .select("*")
      .order("event_datetime");
    if (error) setError(error.message);
    else setEvents(data as CateringEvent[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("catering_events")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <PageHeader
        title="Catering"
        subtitle="Upcoming events at your branch."
        actions={
          <CateringEventDialog locationId={locationId} onSaved={load} />
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <LoadingState label="Loading events…" />
      ) : !events || events.length === 0 ? (
        <EmptyState
          title="No catering events yet"
          body="Log your first booking to start tracking prep and payments."
        />
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const dt = new Date(e.event_datetime);
            const { done, total } = checklistProgress(e.checklist);
            const pct = total ? (done / total) * 100 : 0;
            return (
              <Card key={e.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-forest">
                        {e.customer_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.customer_phone}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={CATERING_STATUS_BADGE[e.status]}
                        label={CATERING_STATUS_LABEL[e.status]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {dt.toLocaleString()}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {e.guest_count} guests
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      CA${Number(e.total_amount).toFixed(2)} · CA$
                      {Number(e.balance_due).toFixed(2)} due
                    </span>
                  </div>

                  {total > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Preparation
                        </span>
                        <span className="font-medium">
                          {done} / {total} tasks
                        </span>
                      </div>
                      <Progress value={pct} className="mt-1.5 h-2" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(e)}
                    >
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      }
                      title={`Delete "${e.customer_name}" event?`}
                      description="This booking will be permanently removed."
                      confirmLabel="Delete"
                      onConfirm={() => handleDelete(e.id)}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <CateringEventDialog
          event={editing}
          locationId={locationId}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
