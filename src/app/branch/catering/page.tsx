"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import type { CateringEvent, CateringStatus } from "@/lib/supabase/types";

const statusKind: Record<CateringStatus, StatusKind> = {
  INQUIRY: "pending",
  CONFIRMED: "in-stock",
  COMPLETED: "completed",
  CANCELLED: "error",
};
const statusLabel: Record<CateringStatus, string> = {
  INQUIRY: "Inquiry",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

type ChecklistItem = { label: string; done?: boolean };

function checklistProgress(raw: unknown): { done: number; total: number } {
  if (!Array.isArray(raw)) return { done: 0, total: 0 };
  const items = raw as ChecklistItem[];
  return { done: items.filter((i) => i?.done).length, total: items.length };
}

export default function BranchCateringPage() {
  const [events, setEvents] = useState<CateringEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("catering_events")
        .select("*")
        .order("event_datetime");
      if (error) setError(error.message);
      else setEvents(data as CateringEvent[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <PageHeader
        title="Catering"
        subtitle="Upcoming events at your branch."
        actions={
          <Button size="lg" disabled>
            <Plus className="size-4" /> Add Event
          </Button>
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <EmptyState title="No upcoming catering events" />
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
                    <StatusBadge status={statusKind[e.status]} label={statusLabel[e.status]} />
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
                        <span className="text-muted-foreground">Preparation</span>
                        <span className="font-medium">
                          {done} / {total} tasks
                        </span>
                      </div>
                      <Progress value={pct} className="mt-1.5 h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
