"use client";
import { FilterBar } from "@/components/shared/FilterBar";


import { useMemo, useState } from "react";



import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FormSelect } from "@/components/shared/FormSelect";
import { Label } from "@/components/ui/label";
import { Banner } from "@/components/shared/Banner";

import { CatalogItemActions, CatalogItemStatus } from "@/components/admin/CatalogItemActions";
import { CatalogItemDialog } from "@/components/admin/CatalogItemDialog";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchCatalog } from "@/lib/admin/data";
import { useCatalogFilters } from "@/lib/useCatalogFilters";
import { catalogCategory } from "@/lib/catalog";
import { CatalogFilters } from "@/components/shared/CatalogFilters";
import { formatMoney, taxLabel, DEFAULT_STOCK_THRESHOLD } from "@/lib/format";

type CatalogStatus = "all" | "active" | "inactive";

export default function AdminCatalogPage() {
  const { data, loading, error: loadError, refresh } = useAsyncData(fetchCatalog);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [status, setStatus] = useState<CatalogStatus>("all");
  const filters = useCatalogFilters(data);


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
    if (!filters.filtered) return null;
    if (status === "active") return filters.filtered.filter((r) => r.is_active);
    if (status === "inactive") return filters.filtered.filter((r) => !r.is_active);
    return filters.filtered;
  }, [filters.filtered, status]);

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
    { key: "category", header: "Category", render: (r) => catalogCategory(r.category) },
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
      render: (r) => <CatalogItemStatus active={r.is_active}/>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: item=><CatalogItemActions item={item} onEdit={setEditing} onToggle={toggleActive}/>,
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

      <FilterBar columns={3}>
        <CatalogFilters inline id="catalog" search={filters.search} category={filters.category} categories={filters.categories} onSearch={filters.setSearch} onCategory={filters.setCategory}/>
        <div className="space-y-1.5"><Label htmlFor="catalog-status">Status</Label><FormSelect id="catalog-status" value={status} onChange={setStatus} options={[{value:"all",label:"All statuses"},{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/></div>
      </FilterBar>
      <DataTable
        renderCard={item=><>
          <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words font-medium">{item.name}</h3><CatalogItemStatus active={item.is_active}/></div>
          <p className="text-xs text-muted-foreground">{catalogCategory(item.category)} · {item.unit_type}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Rate</dt><dd>{formatMoney(item.default_price)}</dd></div><div><dt className="text-xs text-muted-foreground">Tax</dt><dd>{taxLabel(item.is_taxable)}</dd></div><div><dt className="text-xs text-muted-foreground">Threshold</dt><dd>{item.low_stock_threshold??DEFAULT_STOCK_THRESHOLD}</dd></div></dl>
          <div className="border-t pt-2"><CatalogItemActions item={item} onEdit={setEditing} onToggle={toggleActive}/></div>
        </>}
        data={rows}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No items in this view"
        emptyBody="Add a product or adjust your search and filters."
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
