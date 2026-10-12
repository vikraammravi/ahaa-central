"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { Banner } from "@/components/shared/Banner";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAsyncData } from "@/lib/useAsyncData";
import { fetchInventory, type InventoryCount, type InventoryItem, type InventoryWorkspace } from "@/lib/inventory";
import { formatDate, formatDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { InventoryEntryDialog } from "./InventoryEntryDialog";

type CountLine={id:string;item_name:string;unit_type:string;quantity:number;opening_quantity:number|null;received_quantity:number|null;used_quantity:number|null;wasted_quantity:number|null;adjustment_quantity:number|null};
function CountHistoryDialog({count,onClose}:{count:InventoryCount;onClose:()=>void}){
 const load=useCallback(async(signal:AbortSignal)=>{const {data,error}=await supabase.from("branch_inventory_lines").select("id,item_name,unit_type,quantity,opening_quantity,received_quantity,used_quantity,wasted_quantity,adjustment_quantity").eq("count_id",count.id).order("item_name").abortSignal(signal);if(error)throw new Error(error.message);return data as CountLine[];},[count.id]);
 const {data,loading,error}=useAsyncData(load);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Closing Count — {formatDate(count.count_date)}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Last updated by {count.submitted_name} · {formatDateTime(count.submitted_at)}</p>{error&&<Banner tone="danger">{error}</Banner>}<DataTable data={data} loading={loading} columns={[{key:"name",header:"Item",className:"whitespace-normal",render:line=>line.item_name},...(["opening_quantity","received_quantity","used_quantity","wasted_quantity","adjustment_quantity"] as const).map((field,index)=>({key:field,header:["Opening","Received","Used","Wasted","Adjustment"][index],align:"right" as const,render:(line:CountLine)=>line[field]??"—"})),{key:"quantity",header:"Closing",align:"right",render:line=>`${line.quantity} ${line.unit_type}`}]} rowKey={line=>line.id}/>{count.notes&&<p className="text-sm">Notes: {count.notes}</p>}</DialogContent></Dialog>;
}
export function BranchInventoryScreen({canSubmit=false,canPlaceOrder=false}:{canSubmit?:boolean;canPlaceOrder?:boolean}){
 const [section,setSection]=useState<"inventory"|"history">("inventory");
 const [date,setDate]=useState("");const [page,setPage]=useState(0);const [editing,setEditing]=useState<InventoryWorkspace|null>(null);const [viewed,setViewed]=useState<InventoryCount|null>(null);const [success,setSuccess]=useState(false);
 const load=useCallback((signal:AbortSignal)=>fetchInventory(signal,date,undefined,page),[date,page]);
 const {data,loading,error,refresh}=useAsyncData(load);
 const columns:Column<InventoryItem>[]=[{key:"name",header:"Item",className:"whitespace-normal",render:item=><div>{item.name}<p className="text-xs text-muted-foreground">{item.unit_type}</p></div>},...(["opening_quantity","received_quantity","used_quantity","wasted_quantity","adjustment_quantity"] as const).map((field,index)=>({key:field,header:["Opening","Received","Used","Wasted","Adjustment"][index],align:"right" as const,render:(item:InventoryItem)=>item[field]??"—"})),{key:"quantity",header:"Closing / Balance",align:"right",render:item=>item.quantity??"—"}];
 const historyColumns:Column<InventoryCount>[]=[{key:"date",header:"Count Date",render:count=>formatDate(count.count_date)},{key:"name",header:"Last Updated By",className:"whitespace-normal",render:count=>count.submitted_name},{key:"time",header:"Updated At",className:"whitespace-normal",render:count=>formatDateTime(count.submitted_at)},{key:"view",header:"",render:count=><Button variant="outline" size="sm" onClick={()=>setViewed(count)}>View</Button>}];
 return <div className="max-w-[1100px] mx-auto space-y-5"><PageHeader title="Daily Inventory" subtitle="Opening + received − used − wasted, with physical-count adjustments tracked." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading||!!editing} onClick={()=>refresh()}>Refresh</Button>{canSubmit&&<Button disabled={!data||loading} onClick={()=>{setSuccess(false);setEditing(data);}}>{data?.current?"Edit Inventory":"Record Inventory"}</Button>}{canPlaceOrder&&<Button asChild variant="outline"><Link href="/branch/order">Place Order</Link></Button>}</div>}/>
 {error&&<Banner tone="danger">{error}</Banner>}{success&&<Banner tone="success">Inventory updated. Your name and update time are recorded.</Banner>}
 {<div className="space-y-1.5 max-w-xs"><Label htmlFor="inventory-date">Inventory date</Label><Input id="inventory-date" type="date" value={date||data?.today||""} max={data?.today} onChange={event=>{setDate(event.target.value);setPage(0);}}/></div>}
 <FilterTabs tabs={[{value:"inventory",label:"Inventory"},{value:"history",label:"Update History"}]} value={section} onChange={setSection}/>
 {section==="inventory"&&<>
 <Card><CardHeader><CardTitle className="text-base">{data?.branch_name??"Branch Inventory"}</CardTitle><p className="text-sm text-muted-foreground">Daily inventory summary</p></CardHeader><CardContent className="space-y-3 text-sm">{data?.latest?<><dl className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div><dt className="text-xs text-muted-foreground">Inventory date</dt><dd className="mt-1 font-medium">{formatDate(data.latest.count_date)}</dd></div><div><dt className="text-xs text-muted-foreground">Updated by</dt><dd className="mt-1 font-medium">{data.latest.submitted_name}</dd></div><div><dt className="text-xs text-muted-foreground">Last update</dt><dd className="mt-1">{formatDateTime(data.latest.submitted_at)}</dd></div></dl>{data.latest.notes&&<p>Notes: {data.latest.notes}</p>}{data.latest.count_date!==data.count_date&&<Banner tone="info">No inventory record has been saved for {formatDate(data.count_date)}. Opening stock is carried from the last closing record; completed pickups are included below.</Banner>}</>:<p className="text-muted-foreground">No inventory record has been saved yet.</p>}</CardContent></Card>
 {data?.items.some(item=>item.needs_review)&&<Banner tone="info">Opening stock or completed pickups changed since this record was saved. Review the updated balance and save any usage or physical-count changes.</Banner>}
 <DataTable data={data?.items??null} columns={columns} loading={loading} rowKey={item=>item.id} emptyTitle="No inventory items"/>
 </>}
 {section==="history"&&<section className="space-y-3"><DataTable data={data?.history??null} columns={historyColumns} loading={loading} rowKey={count=>count.id} emptyTitle="No submissions yet"/><Pagination page={page} pageSize={25} count={data?.history_total??0} busy={loading} onChange={setPage}/></section>}
 {editing&&<InventoryEntryDialog workspace={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setSuccess(true);void refresh(true);}}/>}{viewed&&<CountHistoryDialog count={viewed} onClose={()=>setViewed(null)}/>}
 </div>;
}
