"use client";

import { useState } from "react";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { ProfileEditDialog } from "@/components/admin/ProfileEditDialog";
import type { Profile } from "@/lib/supabase/types";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchUsers } from "@/lib/admin/data";

const statusKind: Record<Profile["status"], StatusKind> = {
  active: "active",
  pending: "pending",
  disabled: "inactive",
};

export default function AdminUsersPage() {
  const { data, loading, error, refresh } = useAsyncData(fetchUsers);
  const profiles = data?.profiles ?? null;
  const locations = data?.locations ?? [];
  const [editing, setEditing] = useState<Profile | null>(null);


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
          key={editing.id}
          profile={editing}
          locations={locations}
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
