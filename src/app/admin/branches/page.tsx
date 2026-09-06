"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { LocationDialog } from "@/components/admin/LocationDialog";
import { supabase } from "@/lib/supabase/client";
import type { Location } from "@/lib/supabase/types";

export default function AdminBranchesPage() {
  const [data, setData] = useState<Location[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("name");
    if (error) setError(error.message);
    else setData(data as Location[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) setError(error.message);
    else load();
  }

  const columns: Column<Location>[] = [
    {
      key: "name",
      header: "Branch",
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          {r.is_central && (
            <div className="text-[11px] text-saffron-hover font-medium mt-0.5">
              Central Kitchen
            </div>
          )}
        </div>
      ),
    },
    {
      key: "city",
      header: "City",
      render: (r) => (r.city ? `${r.city}, ${r.province ?? ""}` : "—"),
    },
    { key: "address", header: "Address", render: (r) => r.address ?? "—", hideOn: "md" },
    { key: "phone", header: "Phone", render: (r) => r.phone ?? "—", hideOn: "sm" },
    {
      key: "status",
      header: "",
      render: (r) => (
        <StatusBadge status="active" label={r.is_central ? "Central" : "Branch"} />
      ),
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
          deleteDescription="Removes this branch. Any orders or users linked to it will need reassignment."
        />
      ),
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Branches"
        subtitle="All Aaha locations, including the central kitchen."
        actions={<LocationDialog onSaved={load} />}
      />
      {error && <Banner tone="danger">{error}</Banner>}
      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No branches yet"
        emptyBody="Add your first branch to start assigning managers and orders."
      />

      {editing && (
        <LocationDialog
          location={editing}
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
