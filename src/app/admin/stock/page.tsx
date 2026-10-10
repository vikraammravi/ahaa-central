"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";
import { stockBadge } from "@/lib/stock";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchCatalog } from "@/lib/admin/data";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD, POLL_INTERVAL } from "@/lib/format";

export default function AdminStockPage() {
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const pendingEdits = useRef<Record<string, number>>({});
  const previousStock = useRef<Record<string, { quantity: number; updatedAt: string }>>({});

  const load = useCallback(async (signal: AbortSignal) => {
      const data = (await fetchCatalog(signal)).filter((item) => item.is_active);
      if (signal.aborted) throw new Error("Request cancelled.");
      const initial: Record<string, number> = {};
      data.forEach((i) => {
        const draft = pendingEdits.current[i.id];
        const isEdited = draft !== undefined && draft !== previousStock.current[i.id]?.quantity && draft !== i.available_stock;
        initial[i.id] = isEdited ? draft : i.available_stock;
        if (!isEdited) previousStock.current[i.id] = { quantity: i.available_stock, updatedAt: i.updated_at };
      });
      pendingEdits.current = initial;
      setEdits(initial);
      return data;
  }, []);
  const { data: items, loading, error: loadError, refresh } = useAsyncData(load, { pollInterval: POLL_INTERVAL, enabled: !saving });
  const dirty = items?.some((i) => edits[i.id] !== undefined && edits[i.id] !== i.available_stock);

  async function save() {
    if (!items) return;
    setSaving(true);
    setError(null);
    try {
      const updates = items
        .filter((i) => edits[i.id] !== undefined && edits[i.id] !== i.available_stock)
        .map((i) => ({ id: i.id, available_stock: edits[i.id], expected_stock: previousStock.current[i.id]?.quantity, expected_updated_at: previousStock.current[i.id]?.updatedAt }));
      if (updates.some((item) => !Number.isInteger(item.available_stock) || item.available_stock < 0 || item.available_stock > 2147483647)) throw new Error("Stock must be a nonnegative whole number.");
      const { error } = await supabase.rpc("save_daily_stock", { p_updates: updates });
      if (error) throw new Error(error.message);
      pendingEdits.current = {};
      previousStock.current = {};
      setSavedAt(new Date());
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
          step={1}
          disabled={saving}
          value={edits[r.id] ?? r.available_stock}
          onChange={(e) => {
            const quantity = Math.max(0, Number(e.target.value) || 0);
            pendingEdits.current[r.id] = quantity;
            setEdits((prev) => ({ ...prev, [r.id]: quantity }));
          }}
          className="w-24 h-9 text-right ml-auto"
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={stockBadge(edits[r.id] ?? r.available_stock, r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD)} />,
    },
    { key: "threshold", header: "Threshold", align: "right", render: (r) => r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      hideOn: "sm",
      render: (r) => formatMoney(r.default_price),
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      hideOn: "md",
      render: (r) => taxLabel(r.is_taxable),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Daily Stock"
        subtitle="Stock updates every 5 seconds. Fulfilled quantities are deducted when orders become Ready."
        actions={
          <Button size="lg" disabled={!dirty || saving} onClick={save}>
            {saving ? "Saving…" : "Save & Broadcast"}
          </Button>
        }
      />
      {(error || loadError) && <Banner tone="danger">{error || loadError}</Banner>}
      {dirty && <Button variant="outline" disabled={saving} onClick={() => { pendingEdits.current = {}; previousStock.current = {}; setEdits({}); setError(null); void refresh(); }}>Discard Edits & Refresh Stock</Button>}
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
