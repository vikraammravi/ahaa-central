"use client";
import { USER_ROLE_LABELS } from "@/lib/users";
import type { Profile, Location } from "@/lib/supabase/types";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
const statusKind:Record<Profile["status"],StatusKind>={active:"active",pending:"pending",disabled:"inactive"};
export function UsersTable({profiles,locations,loading,onEdit,onDelete}:{profiles:Profile[]|null;locations:Location[];loading:boolean;onEdit:(profile:Profile)=>void;onDelete:(id:string)=>Promise<void>}) {
  const branchName = (id?: string | null) =>
    locations.find((l) => l.id === id)?.name ?? "—";

  const columns: Column<Profile>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="font-medium">{r.full_name || "—"}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (r) =>
        USER_ROLE_LABELS[r.role],
    },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
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
      render: (r) => <RowActions onEdit={() => onEdit(r)} onDelete={()=>onDelete(r.id)} deleteTitle={`Delete ${r.full_name||r.email}?`} deleteDescription="Permanently removes their login and profile. Orders, invoices and inventory history will remain." />,
    },
  ];

  return <DataTable data={profiles} columns={columns} loading={loading} rowKey={profile=>profile.id} emptyTitle="No users match" />;
}
