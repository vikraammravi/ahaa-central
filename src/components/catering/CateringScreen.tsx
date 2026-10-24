"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/shared/FormSelect";
import { Label } from "@/components/ui/label";
import { FilterBar } from "@/components/shared/FilterBar";
import { CateringEventDialog,type SavedCateringEvent } from "@/components/branch/CateringEventDialog";
import { businessDateKey } from "@/lib/date-range";
import { formatDate } from "@/lib/format";
import { CateringTable } from "@/components/branch/CateringTable";
import { completePastCatering, fetchCatering, deleteCatering, fetchCentralCateringLocation } from "@/lib/catering-data";
import { useAsyncData } from "@/lib/useAsyncData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/shared/Pagination";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { CATERING_STATUSES, CATERING_STATUS_LABEL } from "@/lib/catering";
import type { CateringEvent, CateringStatus } from "@/lib/supabase/types";

export function CateringScreen({central=false}:{central?:boolean}) {
  const { profile,loading:userLoading,error:userError } = useCurrentUser();
  const centralLocation=useAsyncData(fetchCentralCateringLocation,{enabled:central});
  const locationId = central ? centralLocation.data : profile?.location_id ?? null;
  const businessDate=businessDateKey(new Date());
  const maintain=useCallback(()=>completePastCatering(locationId!,businessDate),[locationId,businessDate]);
  const completion=useAsyncData(maintain,{enabled:!!locationId});
  const [page,setPage]=useState(0);


  const [editing, setEditing] = useState<CateringEvent | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CateringStatus | "ALL">("CONFIRMED");
  const [date,setDate]=useState("");
  const [savedMessage,setSavedMessage]=useState<string|null>(null);

  const debouncedSearch=useDebouncedValue(search);
  const load=useCallback((signal:AbortSignal)=>fetchCatering({page,search:debouncedSearch,status,startDate:date,endDate:date,locationId:locationId??undefined},signal),[page,debouncedSearch,status,locationId,date]);
  const {data,loading,error,refresh}=useAsyncData(load,{enabled:!!locationId&&completion.data===locationId,pollInterval:60000});
  async function handleDelete(id:string){await deleteCatering(id);await refresh(true);}
  function handleSaved(saved:SavedCateringEvent){
    const nextDate=businessDateKey(saved.event_datetime);
    const nextStatus: CateringStatus=saved.status==="CONFIRMED"&&nextDate<businessDateKey(new Date())?"COMPLETED":saved.status;
    const sameFilters=status===nextStatus&&date===nextDate&&search===""&&page===0;
    setEditing(null);setStatus(nextStatus);setDate(nextDate);setSearch("");setPage(0);
    setSavedMessage(`Booking saved. Showing ${CATERING_STATUS_LABEL[nextStatus]} bookings for ${formatDate(saved.event_datetime)}.`);
    if(sameFilters)void refresh(true);
  }
  return <div className="max-w-[1200px] mx-auto space-y-4 min-w-0">
    <PageHeader title="Catering" subtitle={central?"Manage central-kitchen bookings, customer calls, and payments.":"Manage bookings, customer calls, and payments."} actions={<CateringEventDialog locationId={locationId} trigger={<Button disabled={!locationId}>Add Event</Button>} onSaved={handleSaved} />} />
    {savedMessage&&<Banner tone="success">{savedMessage}</Banner>}
    {(error||completion.error||centralLocation.error||userError)&&<Banner tone="danger">{error||completion.error||centralLocation.error||userError}</Banner>}
    <p className="text-sm text-muted-foreground">Today’s and upcoming confirmed bookings are shown by default. Choose Inquiry to view inquiries or Completed to view completed events.</p>
    <FilterBar columns={3}>
      <div className="space-y-1.5"><Label htmlFor="catering-search">Search customers</Label><Input id="catering-search" className="h-10" type="search" value={search} onChange={(event) => {setSearch(event.target.value);setPage(0);}} placeholder="Name or phone number" /></div>
      <div className="space-y-1.5"><Label htmlFor="catering-status">Status</Label><FormSelect<CateringStatus|"ALL"> id="catering-status" value={status} onChange={value=>{setStatus(value);setPage(0);}} options={[{value:"ALL",label:"All statuses"},...CATERING_STATUSES.map(value=>({value,label:CATERING_STATUS_LABEL[value]}))]}/></div>
      <div className="space-y-1.5"><Label htmlFor="catering-date">Event Date</Label><Input id="catering-date" type="date" className="h-10" value={date} onChange={event=>{setDate(event.target.value);setPage(0);}}/></div>
    </FilterBar>
    <CateringTable events={data?.rows??null} loading={loading||userLoading||centralLocation.loading} onEdit={setEditing} onDelete={handleDelete} />
    <Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/>
    {editing && <CateringEventDialog key={editing.id} event={editing} locationId={locationId} open onOpenChange={(open) => !open && setEditing(null)} onSaved={handleSaved} />}
  </div>;
}
