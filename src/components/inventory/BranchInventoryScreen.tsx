"use client";
import { useCallback, useState } from "react";

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
import { fetchInventory, inventoryDraft, type InventoryCount, type InventoryItem } from "@/lib/inventory";
import { formatDate, formatDateTime, POLL_INTERVAL } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { useInventoryEditor } from "@/lib/useInventoryEditor";
import { useCompactLayout } from "@/lib/useCompactLayout";
import { InventoryMobileCards } from "./InventoryMobileCards";
import { FilterBar } from "@/components/shared/FilterBar";

type CountLine={id:string;item_name:string;unit_type:string;quantity:number;opening_quantity:number|null;received_quantity:number|null;used_quantity:number|null;wasted_quantity:number|null;adjustment_quantity:number|null};
function CountHistoryDialog({count,onClose}:{count:InventoryCount;onClose:()=>void}){
 const load=useCallback(async(signal:AbortSignal)=>{const {data,error}=await supabase.from("branch_inventory_lines").select("id,item_name,unit_type,quantity,opening_quantity,received_quantity,used_quantity,wasted_quantity,adjustment_quantity").eq("count_id",count.id).order("item_name").abortSignal(signal);if(error)throw new Error(error.message);return data as CountLine[];},[count.id]);
 const {data,loading,error}=useAsyncData(load);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>Closing Count — {formatDate(count.count_date)}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Last updated by {count.submitted_name} · {formatDateTime(count.submitted_at)}</p>{error&&<Banner tone="danger">{error}</Banner>}<DataTable data={data} loading={loading} columns={[{key:"name", cardSpan:2,header:"Item",className:"whitespace-normal",render:line=>line.item_name},{key:"unit",header:"Unit",render:line=>line.unit_type},...(["opening_quantity","received_quantity","used_quantity","wasted_quantity"] as const).map((field,index)=>({key:field,header:["Opening","Received","Used","Wasted"][index],align:"right" as const,render:(line:CountLine)=>line[field]??"—"})),{key:"quantity",header:"Closing",align:"right",render:line=>line.quantity}]} rowKey={line=>line.id}/>{count.notes&&<p className="text-sm">Notes: {count.notes}</p>}</DialogContent></Dialog>;
}
export function BranchInventoryScreen({canSubmit=false}:{canSubmit?:boolean}){
 const [section,setSection]=useState<"inventory"|"history">("inventory");
 const [search,setSearch]=useState("");
 const mobile=useCompactLayout();
 const [changedOnly,setChangedOnly]=useState(false);
 const [historyDate,setHistoryDate]=useState("");
 const [date,setDate]=useState("");const [page,setPage]=useState(0);const [viewed,setViewed]=useState<InventoryCount|null>(null);const [success,setSuccess]=useState(false);
 const activeDate=section==="history"?historyDate:date;
 const load=useCallback((signal:AbortSignal)=>fetchInventory(signal,activeDate,undefined,page),[activeDate,page]);
 const {data,loading,error,refresh}=useAsyncData(load,{pollInterval:POLL_INTERVAL});
 const editor=useInventoryEditor(data,()=>{setSuccess(true);void refresh(true);});
 const editing=editor.workspace;
 const isChanged=(item:InventoryItem)=>{
  if(!editing)return false;
  const original=inventoryDraft(item),draft=editor.drafts[item.id];
  return draft.wasted!==original.wasted||draft.closing!==original.closing;
 };
 const changedCount=editing?.items.filter(isChanged).length??0;
 const visibleItems=(editing??data)?.items.filter(item=>item.name.toLowerCase().includes(search.trim().toLowerCase())&&(!mobile||!editing||!changedOnly||isChanged(item)))??[];
 const editableCell=(item:InventoryItem,field:"opening"|"used"|"wasted"|"closing",label:string)=>editing&&(field==="wasted"||field==="closing")?<Input aria-label={`${label} for ${item.name}`} type="number" inputMode="numeric" min={0} max={2147483647} step={1} disabled={editor.saving} value={editor.drafts[item.id][field]} onChange={event=>editor.update(item.id,field,event.target.value)} className={mobile?"w-full h-11 text-base text-right":"w-24 h-10 text-sm text-right ml-auto"}/>:<span aria-label={`${label} for ${item.name}`}>{editing?editor.drafts[item.id][field]:field==="used"?(item.quantity===null?"—":inventoryDraft(item).used):field==="closing"?item.quantity??"—":item[`${field}_quantity`]??"—"}</span>;
 const columns:Column<InventoryItem>[]=[
  {key:"name", cardSpan:2,header:"Item",className:"whitespace-normal",render:item=>item.name},
  {key:"unit",header:"Unit",render:item=>item.unit_type},
  {key:"opening",header:"Opening",align:"right",render:item=>editableCell(item,"opening","Opening")},
  {key:"received",header:"Received",align:"right",render:item=>item.received_quantity},
  {key:"used",header:"Used",align:"right",render:item=>editableCell(item,"used","Used")},
  {key:"wasted",header:"Wasted",align:"right",render:item=>editableCell(item,"wasted","Wasted")},
  {key:"quantity",header:"Closing / Balance",align:"right",render:item=>editableCell(item,"closing","Closing")},
 ];
 const historyColumns:Column<InventoryCount>[]=[{key:"date",header:"Count Date",render:count=>formatDate(count.count_date)},{key:"name", cardSpan:2,header:"Last Updated By",className:"whitespace-normal",render:count=>count.submitted_name},{key:"time",header:"Updated At",className:"whitespace-normal",render:count=>formatDateTime(count.submitted_at)},{key:"view",header:"",render:count=><Button variant="outline" size="sm" onClick={()=>setViewed(count)}>View</Button>}];
 const filters = <FilterBar className={section==="history"?"w-full max-w-[200px]":"grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_200px] gap-3 [&>div]:min-w-0"}>{section==="inventory"&&<div className="space-y-1.5"><Label htmlFor="inventory-search">Search Name</Label><Input id="inventory-search" className="h-11 lg:h-10 cursor-text" type="search" placeholder="Search item name" value={search} onChange={event=>setSearch(event.target.value)}/></div>}<div className="space-y-1.5"><Label htmlFor="inventory-date">Inventory date</Label><Input id="inventory-date" className="h-11 lg:h-10 max-w-full" type="date" value={section==="history"?historyDate:date||data?.today||""} max={data?.today} onChange={async event=>{const value=event.target.value;if(editing&&!await editor.cancel())return;if(section==="history")setHistoryDate(value);else setDate(value);setPage(0);}}/></div></FilterBar>;
 return <div className="max-w-[1100px] mx-auto space-y-5"><PageHeader title="Daily Inventory" subtitle="Track opening stock, received pickups, usage, waste and closing balance." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loading||!!editing} onClick={()=>refresh()}>Refresh</Button>{canSubmit&&section==="inventory"&&(!mobile||!editing)&&(editing?<><Button variant="outline" disabled={editor.saving} onClick={editor.cancel}>Cancel</Button><Button disabled={editor.saving} onClick={editor.save}>{editor.saving?"Saving…":"Save Inventory"}</Button></>:<Button disabled={!data||!data.items.length||loading} onClick={()=>{setSuccess(false);setChangedOnly(false);editor.edit();}}>Edit Inventory</Button>)}</div>}/>
 {error&&<Banner tone="danger">{error}</Banner>}{success&&<Banner tone="success">Inventory updated. Your name and update time are recorded.</Banner>}
 <Card><CardHeader className="gap-0.5"><CardTitle className="text-base">{data?.branch_name??"Branch Inventory"}</CardTitle><p className="text-sm text-muted-foreground">Daily inventory summary</p></CardHeader><CardContent className="space-y-2 text-sm">{data?.latest?<><dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4"><div><dt className="text-xs text-muted-foreground">Inventory date</dt><dd className="mt-1 font-medium">{formatDate(data.latest.count_date)}</dd></div><div><dt className="text-xs text-muted-foreground">Updated by</dt><dd className="mt-1 font-medium">{data.latest.submitted_name}</dd></div><div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted-foreground">Last update</dt><dd className="mt-1">{formatDateTime(data.latest.submitted_at)}</dd></div></dl>{data.latest.notes&&<p>Notes: {data.latest.notes}</p>}{data.latest.count_date!==data.count_date&&<Banner tone="info">No inventory record has been saved for {formatDate(data.count_date)}. Opening stock is carried from the last closing record; completed pickups are included below.</Banner>}</>:<p className="text-muted-foreground">No inventory record has been saved yet.</p>}</CardContent></Card>
 <FilterTabs tabs={[{value:"inventory",label:"Inventory"},{value:"history",label:"Update History"}]} value={section} onChange={async value=>{if(editing&&!await editor.cancel())return;setSection(value);setPage(0);}}/>
 {section==="inventory"&&<>

 {data?.items.some(item=>item.needs_review)&&<Banner tone="info">Opening stock or completed pickups changed since this record was saved. Review the updated balance and save any usage or physical-count changes.</Banner>}

 <div className="space-y-4 mb-5">{filters}{mobile&&editing&&<div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{visibleItems.length} of {editing.items.length} items</span><Button variant={changedOnly?"secondary":"outline"} size="sm" aria-pressed={changedOnly} onClick={()=>setChangedOnly(value=>!value)}>Show changed only</Button></div>}</div>
 {editor.error&&(!mobile||!editing)&&<Banner tone="danger">{editor.error}</Banner>}
 {mobile?<InventoryMobileCards items={visibleItems} loading={loading} renderCell={editableCell} isChanged={isChanged}/>:<DataTable data={data?visibleItems:null} columns={columns} loading={loading} rowKey={item=>item.id} emptyTitle="No inventory items match your search"/>}
 {mobile&&editing&&<><div className="h-20" aria-hidden="true"/><div className="fixed bottom-20 left-0 right-0 z-30 border-y bg-background p-3 shadow-sm" aria-label="Inventory actions">{editor.error&&<div className="mb-2"><Banner tone="danger">{editor.error}</Banner></div>}<div className="mx-auto flex max-w-[1100px] items-center justify-between gap-2"><span className="text-sm tabular-nums" role="status">{changedCount} changed</span><div className="flex gap-2"><Button variant="outline" disabled={editor.saving} onClick={editor.cancel}>Cancel</Button><Button disabled={editor.saving} onClick={editor.save}>{editor.saving?"Saving…":"Save Inventory"}</Button></div></div></div></>}
 </>}
 {section==="history"&&<section className="space-y-3">{filters}<DataTable data={data?.history??null} columns={historyColumns} loading={loading} rowKey={count=>count.id} emptyTitle="No submissions yet"/><Pagination page={page} pageSize={25} count={data?.history_total??0} busy={loading} onChange={setPage}/></section>}
 {viewed&&<CountHistoryDialog count={viewed} onClose={()=>setViewed(null)}/>}
 </div>;
}
