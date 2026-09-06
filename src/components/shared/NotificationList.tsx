"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./Spinner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem, Order } from "@/lib/supabase/types";

type Tone = "info" | "warn" | "danger" | "success";
type Item = { title: string; body: string; time: string; tone: Tone };

const toneDot: Record<Tone, string> = {
  info: "bg-[#F59E0B]",
  warn: "bg-[#D97706]",
  danger: "bg-[#DC2626]",
  success: "bg-[#16A34A]",
};

// Derived from live tables — no notifications table exists yet.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationList({ audience }: { audience: "admin" | "branch" }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list: Item[] = [];

      if (audience === "admin") {
        const [{ data: newOrders }, { data: lowItems }] = await Promise.all([
          supabase
            .from("orders")
            .select("*, locations(name)")
            .eq("status", "SUBMITTED")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("catalog_items")
            .select("*")
            .eq("is_active", true)
            .lt("available_stock", 20)
            .order("available_stock"),
        ]);

        (newOrders ?? []).forEach((o: Order & { locations: { name: string } | null }) => {
          list.push({
            title: "New branch order",
            body: `${o.locations?.name ?? "Branch"} submitted #${o.order_number}`,
            time: timeAgo(o.created_at),
            tone: "info",
          });
        });
        (lowItems ?? []).forEach((i: CatalogItem) => {
          list.push({
            title: i.available_stock === 0 ? "Out of stock" : "Low stock",
            body: `${i.name} — ${i.available_stock} left`,
            time: timeAgo(i.updated_at),
            tone: i.available_stock === 0 ? "danger" : "warn",
          });
        });
      } else {
        const { data: myOrders } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        (myOrders ?? []).forEach((o: Order) => {
          if (o.status === "READY") {
            list.push({
              title: "Ready for pickup",
              body: `Order #${o.order_number} is ready.`,
              time: timeAgo(o.updated_at),
              tone: "success",
            });
          }
          if (o.status === "PREPARING") {
            list.push({
              title: "Order in progress",
              body: `Central kitchen is preparing #${o.order_number}.`,
              time: timeAgo(o.updated_at),
              tone: "info",
            });
          }
        });
        list.push({
          title: "Central stock published",
          body: "Today's inventory is live. Order before 10:00 AM.",
          time: "today",
          tone: "info",
        });
      }

      setItems(list);
      setLoading(false);
    })();
  }, [audience]);

  if (loading) {
    return <LoadingState label="Loading notifications…" />;
  }

  if (!items || items.length === 0) {
    return <EmptyState title="No notifications" icon={<Bell className="size-5" />} />;
  }

  return (
    <div className="space-y-2">
      {items.map((n, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 flex items-start gap-3">
            <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", toneDot[n.tone])} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-[11px] text-muted-foreground shrink-0">
                  {n.time}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
