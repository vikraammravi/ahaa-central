"use client";
import { FilterBar } from "@/components/shared/FilterBar";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreateBranchUserDialog } from "@/components/admin/CreateBranchUserDialog";

import { PageHeader } from "@/components/shared/PageHeader";

import { Banner } from "@/components/shared/Banner";

import { UsersTable } from "@/components/admin/UsersTable";
import { deleteUserAccount } from "@/lib/user-data";
import { ProfileEditDialog } from "@/components/admin/ProfileEditDialog";
import type { Profile, ProfileStatus } from "@/lib/supabase/types";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchUsers, fetchLocations, PAGE_SIZE } from "@/lib/admin/data";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/shared/FormSelect";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export default function AdminUsersPage() {
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState("");
  const [branchId,setBranchId]=useState("");
  const [status,setStatus]=useState<ProfileStatus|"">("");
  const debouncedSearch=useDebouncedValue(search);
  const load=useCallback((signal:AbortSignal)=>fetchUsers({page,search:debouncedSearch,branchId,status},signal),[page,debouncedSearch,branchId,status]);
  const { data, loading, error, refresh } = useAsyncData(load);
  const branchLocations=useAsyncData(fetchLocations);
  const profiles = data?.profiles ?? null;
  const locations = branchLocations.data ?? [];
  const [creating,setCreating]=useState(false);
  const [created,setCreated]=useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);


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
      <FilterBar columns={3}>
        <div className="space-y-1.5 sm:col-span-2 xl:col-span-1"><Label htmlFor="users-search">Search users</Label><Input id="users-search" aria-label="Search users by name or email" type="search" className="h-10 cursor-text" placeholder="Search name or email" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}} /></div>
        <div className="space-y-1.5"><Label htmlFor="users-branch">Branch</Label><FormSelect id="users-branch" value={branchId} onChange={value=>{setBranchId(value);setPage(0);}} options={[{value:"",label:"All branches"},...locations.map(location=>({value:location.id,label:location.name}))]}/></div>
        <div className="space-y-1.5"><Label htmlFor="users-status">Status</Label><FormSelect<ProfileStatus|""> id="users-status" value={status} onChange={value=>{setStatus(value);setPage(0);}} options={[{value:"",label:"All statuses"},{value:"active",label:"Active"},{value:"pending",label:"Pending"},{value:"disabled",label:"Disabled"}]}/></div>
      </FilterBar>
      <UsersTable profiles={profiles} locations={locations} loading={loading} onEdit={setEditing} onDelete={async id=>{await deleteUserAccount(id);await refresh(true);}} />
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
