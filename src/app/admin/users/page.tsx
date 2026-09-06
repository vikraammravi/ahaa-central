"use client";

import { useEffect, useState } from "react";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { ProfileEditDialog } from "@/components/admin/ProfileEditDialog";
import { supabase } from "@/lib/supabase/client";
import type { Location, Profile } from "@/lib/supabase/types";

const statusKind: Record<Profile["status"], StatusKind> = {
  active: "active",
  pending: "pending",
  disabled: "inactive",
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: p, error: pe }, { data: l, error: le }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("locations").select("*").order("name"),
    ]);
    if (pe) setError(pe.message);
    else if (le) setError(le.message);
    else {
      setProfiles(p as Profile[]);
      setLocations(l as Location[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const branchName = (id?: string | null) =>
    locations.find((l) => l.id === id)?.name ?? "—";

  const columns: Column<Profile>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div>
          <div className="font-medium">{r.full_name || "—"}</div>
          <div className="text-xs text-muted-foreground">{r.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (r) =>
        r.role === "CENTRAL_ADMIN" ? "Central Admin" : "Branch Manager",
    },
    {
      key: "branch",
      header: "Branch",
      render: (r) => branchName(r.location_id),
      hideOn: "sm",
    },
    { key: "phone", header: "Phone", render: (r) => r.phone ?? "—", hideOn: "md" },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={statusKind[r.status]} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => <RowActions onEdit={() => setEditing(r)} />,
    },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <PageHeader
        title="Users & Access"
        subtitle="Central admins and branch managers."
      />
      {error && <Banner tone="danger">{error}</Banner>}
      <Banner tone="info">
        To invite a new user: Supabase → Authentication → Users → Add user.
        A profile row is auto-created; edit it here to set role, status, and
        branch.
      </Banner>
      <DataTable
        data={profiles}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No users yet"
      />

      {editing && (
        <ProfileEditDialog
          profile={editing}
          locations={locations}
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
