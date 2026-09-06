"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";

function stockBadge(available: number): StatusKind {
  if (available === 0) return "out-of-stock";
  if (available < 20) return "low-stock";
  return "in-stock";
}

export default function AdminStockPage() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) setError(error.message);
    else {
      setItems(data as CatalogItem[]);
      const initial: Record<string, number> = {};
      (data as CatalogItem[]).forEach((i) => (initial[i.id] = i.available_stock));
      setEdits(initial);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = items?.some((i) => edits[i.id] !== i.available_stock);

  async function save() {
    if (!items) return;
    setSaving(true);
    setError(null);
    try {
      const updates = items
        .filter((i) => edits[i.id] !== i.available_stock)
        .map((i) => ({ id: i.id, available_stock: edits[i.id] }));
      for (const u of updates) {
        const { error } = await supabase
          .from("catalog_items")
          .update({ available_stock: u.available_stock })
          .eq("id", u.id);
        if (error) throw error;
      }
      setSavedAt(new Date());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<CatalogItem>[] = [
    {
      key: "product",
      header: "Product",
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {r.category} · {r.unit_type}
          </div>
        </div>
      ),
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (r) => (
        <Input
          type="number"
          min={0}
          value={edits[r.id] ?? r.available_stock}
          onChange={(e) =>
            setEdits((prev) => ({
              ...prev,
              [r.id]: Math.max(0, Number(e.target.value) || 0),
            }))
          }
          className="w-24 h-9 text-right ml-auto"
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={stockBadge(edits[r.id] ?? r.available_stock)} />,
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      hideOn: "sm",
      render: (r) => `CA$${Number(r.default_price).toFixed(2)}`,
    },
    {
      key: "tax",
      header: "Taxable",
      align: "right",
      hideOn: "md",
      render: (r) => (r.is_taxable ? "Yes" : "No"),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Daily Stock"
        subtitle="Set today's available quantity for each active product."
        actions={
          <Button size="lg" disabled={!dirty || saving} onClick={save}>
            {saving ? "Saving…" : "Save & Broadcast"}
          </Button>
        }
      />
      {error && <Banner tone="danger">{error}</Banner>}
      {savedAt && !dirty && (
        <Banner tone="success">
          Stock updated at {savedAt.toLocaleTimeString()}. Branches will see
          the new numbers on their next order.
        </Banner>
      )}
      <DataTable
        data={items}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No active catalog items"
      />
    </div>
  );
}
