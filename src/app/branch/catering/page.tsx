"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Banner } from "@/components/shared/Banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CateringEventDialog } from "@/components/branch/CateringEventDialog";
import { CateringTable } from "@/components/branch/CateringTable";
import { fetchCatering, deleteCatering } from "@/lib/catering-data";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/shared/Pagination";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { CATERING_STATUSES, CATERING_STATUS_LABEL } from "@/lib/catering";
import type { CateringEvent, CateringStatus } from "@/lib/supabase/types";

export default function BranchCateringPage() {
  const { profile } = useCurrentUser();
  const locationId = profile?.location_id ?? null;
  const [page,setPage]=useState(0);


  const [editing, setEditing] = useState<CateringEvent | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CateringStatus | "ALL">("ALL");

  const debouncedSearch=useDebouncedValue(search);
  const load=useCallback((signal:AbortSignal)=>fetchCatering({page,search:debouncedSearch,status},signal),[page,debouncedSearch,status]);
  const {data,loading,error,refresh}=useAsyncData(load);
  async function handleDelete(id:string){await deleteCatering(id);await refresh(true);}
  return <div className="max-w-[1200px] mx-auto space-y-4 min-w-0">
    <PageHeader title="Catering" subtitle="Manage bookings, customer calls, and payments." actions={<CateringEventDialog locationId={locationId} onSaved={()=>refresh(true)} />} />
    {error && <Banner tone="danger">{error}</Banner>}
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
      <div className="space-y-1.5"><Label htmlFor="catering-search">Search customers</Label><Input id="catering-search" value={search} onChange={(event) => {setSearch(event.target.value);setPage(0);}} placeholder="Name or phone number" /></div>
      <div className="space-y-1.5"><Label htmlFor="catering-status">Status</Label><select id="catering-status" value={status} onChange={(event) => {setStatus(event.target.value as CateringStatus | "ALL");setPage(0);}} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="ALL">All statuses</option>{CATERING_STATUSES.map((value) => <option key={value} value={value}>{CATERING_STATUS_LABEL[value]}</option>)}</select></div>
    </div>
    <CateringTable events={data?.rows??null} loading={loading} onEdit={setEditing} onDelete={handleDelete} />
    <Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/>
    {editing && <CateringEventDialog key={editing.id} event={editing} locationId={locationId} open onOpenChange={(open) => !open && setEditing(null)} onSaved={() => { setEditing(null); void refresh(true); }} />}
  </div>;
}
