"use client";

import { useCallback, useState } from "react";
import { USER_ROLE_LABELS } from "@/lib/users";
import { Button } from "@/components/ui/button";
import { CreateBranchUserDialog } from "@/components/admin/CreateBranchUserDialog";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Banner } from "@/components/shared/Banner";
import { RowActions } from "@/components/shared/RowActions";
import { ProfileEditDialog } from "@/components/admin/ProfileEditDialog";
import type { Profile } from "@/lib/supabase/types";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchUsers, fetchLocations, PAGE_SIZE } from "@/lib/admin/data";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const statusKind: Record<Profile["status"], StatusKind> = {
  active: "active",
  pending: "pending",
  disabled: "inactive",
};

export default function AdminUsersPage() {
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const debouncedSearch=useDebouncedValue(search);
  const load=useCallback((signal:AbortSignal)=>fetchUsers({page,search:debouncedSearch},signal),[page,debouncedSearch]);
  const { data, loading, error, refresh } = useAsyncData(load);
  const branchLocations=useAsyncData(fetchLocations);
  const profiles = data?.profiles ?? null;
  const locations = branchLocations.data ?? [];
  const [creating,setCreating]=useState(false);
  const [created,setCreated]=useState(false);
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
        USER_ROLE_LABELS[r.role],
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
        subtitle="Central admins, branch managers and branch employees."
        actions={<Button onClick={()=>setCreating(true)}>Add Branch User</Button>}
      />
      {(error||branchLocations.error) && <Banner tone="danger">{error||branchLocations.error}</Banner>}
      {created&&<Banner tone="success">User created. They can sign in with the email and starting password you entered.</Banner>}
      {creating&&<CreateBranchUserDialog locations={locations} open onOpenChange={setCreating} onCreated={()=>{setCreating(false);setCreated(true);void refresh();}}/>}
      <Input aria-label="Search users by name or email" placeholder="Search name or email" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}} />
      <DataTable
        data={profiles}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id}
        emptyTitle="No users match"
      />

      <Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/>
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
