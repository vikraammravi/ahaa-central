"use client";

import { useMemo, useState } from "react";
import { Power, PowerOff } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FilterTabs, type FilterTab } from "@/components/shared/FilterTabs";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { CatalogItemDialog } from "@/components/admin/CatalogItemDialog";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchCatalog } from "@/lib/admin/data";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD } from "@/lib/format";

type Tab = "all" | "active" | "inactive";

const tabs: FilterTab<Tab>[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function AdminCatalogPage() {
  const { data, loading, error: loadError, refresh } = useAsyncData(fetchCatalog);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [tab, setTab] = useState<Tab>("all");


  async function toggleActive(row: CatalogItem) {
    setError(null);
    const { error } = await supabase
      .from("catalog_items")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) setError(error.message);
    else await refresh();
  }

  const rows = useMemo(() => {
    if (!data) return null;
    if (tab === "active") return data.filter((r) => r.is_active);
    if (tab === "inactive") return data.filter((r) => !r.is_active);
    return data;
  }, [data, tab]);

  const withCounts = useMemo<FilterTab<Tab>[]>(() => {
    if (!data) return tabs;
    return tabs.map((t) => ({
      ...t,
      count:
        t.value === "all"
          ? data.length
          : t.value === "active"
          ? data.filter((r) => r.is_active).length
          : data.filter((r) => !r.is_active).length,
    }));
  }, [data]);

  const columns: Column<CatalogItem>[] = [
    {
      key: "name",
      header: "Item",
      render: (r) => (
        <span className={r.is_active ? "font-medium" : "font-medium text-muted-foreground"}>
          {r.name}
        </span>
      ),
    },
    { key: "category", header: "Category", render: (r) => r.category, hideOn: "sm" },
    { key: "unit", header: "Unit", render: (r) => r.unit_type },
    { key: "threshold", header: "Threshold", align: "right", render: (r) => r.low_stock_threshold ?? DEFAULT_STOCK_THRESHOLD },
    {
      key: "rate",
      header: "Base Rate",
      align: "right",
      render: (r) => formatMoney(r.default_price),
    },
    {
      key: "tax",
      header: "Tax",
      align: "right",
      render: (r) => taxLabel(r.is_taxable),
      hideOn: "sm",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.is_active ? "active" : "inactive"} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <RowActions
          onEdit={() => setEditing(r)}
          extra={
            <DropdownMenuItem
              onSelect={() => toggleActive(r)}
              variant={r.is_active ? "destructive" : "default"}
            >
              {r.is_active ? (
                <>
                  <PowerOff className="size-3.5" /> Deactivate
                </>
              ) : (
                <>
                  <Power className="size-3.5" /> Reactivate
                </>
              )}
            </DropdownMenuItem>
          }
        />
      ),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Catalog"
        subtitle="Products available to branch orders. Deactivate items you no longer sell — history stays intact."
        actions={<CatalogItemDialog onSaved={() => { void refresh(); }} />}
      />
      {(error || loadError) && <Banner tone="danger">{error || loadError}</Banner>}
      <FilterTabs tabs={withCounts} value={tab} onChange={setTab} />
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No items in this view"
        emptyBody="Add your first product or switch to another tab."
      />

      {editing && (
        <CatalogItemDialog
          key={editing.id}
          item={editing}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
