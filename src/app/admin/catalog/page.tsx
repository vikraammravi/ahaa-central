"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { CatalogItemDialog } from "@/components/admin/CatalogItemDialog";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";

export default function AdminCatalogPage() {
  const [data, setData] = useState<CatalogItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .order("name");
    if (error) setError(error.message);
    else setData(data as CatalogItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("catalog_items").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    load();
  }

  const columns: Column<CatalogItem>[] = [
    {
      key: "name",
      header: "Item",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    { key: "category", header: "Category", render: (r) => r.category, hideOn: "sm" },
    { key: "unit", header: "Unit", render: (r) => r.unit_type },
    {
      key: "rate",
      header: "Base Rate",
      align: "right",
      render: (r) => `CA$${Number(r.default_price).toFixed(2)}`,
    },
    {
      key: "tax",
      header: "Taxable",
      align: "right",
      render: (r) => (r.is_taxable ? "Yes" : "No"),
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
          onDelete={() => handleDelete(r.id)}
          deleteTitle={`Delete "${r.name}"?`}
          deleteDescription="Removes it from the catalog. Existing orders keep their line data."
        />
      ),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title="Catalog"
        subtitle="All products available to branch orders."
        actions={<CatalogItemDialog onSaved={load} />}
      />
      {error && <Banner tone="danger">{error}</Banner>}
      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No catalog items yet"
        emptyBody="Add your first product to make it orderable by branches."
      />

      {editing && (
        <CatalogItemDialog
          item={editing}
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
