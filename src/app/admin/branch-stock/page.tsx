"use client";
import {useCallback,useState} from "react";
import {RefreshCw} from "lucide-react";
import {PageHeader} from "@/components/shared/PageHeader";
import {DataTable,type Column} from "@/components/shared/DataTable";
import {CatalogFilters} from "@/components/shared/CatalogFilters";
import {FilterBar} from "@/components/shared/FilterBar";
import {FormSelect} from "@/components/shared/FormSelect";
import {Pagination} from "@/components/shared/Pagination";
import {Banner} from "@/components/shared/Banner";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {useAsyncData} from "@/lib/useAsyncData";
import {useDebouncedValue} from "@/lib/useDebouncedValue";
import {fetchBranchStock,type BranchStockItem} from "@/lib/admin/branch-stock";
import {fetchLocations} from "@/lib/admin/data";
import {PAGE_SIZE} from "@/lib/pagination";
import {formatDateTime} from "@/lib/format";

export default function AdminBranchStockPage(){
  const [search,setSearch]=useState("");const [category,setCategory]=useState("");const [branchId,setBranchId]=useState("");const [page,setPage]=useState(0);
  const debouncedSearch=useDebouncedValue(search);
  const locations=useAsyncData(fetchLocations);
  const load=useCallback((signal:AbortSignal)=>fetchBranchStock({page,search:debouncedSearch,category,branchId},signal),[page,debouncedSearch,category,branchId]);
  const {data,loading,error,refresh}=useAsyncData(load,{pollInterval:30000});
  const branches=data?.branches??[];
  const columnWidth="w-40 whitespace-normal break-words";
  const columns:Column<BranchStockItem>[]=[
    {key:"item",header:"Item Name",className:`sticky left-0 z-10 bg-surface ${columnWidth}`,render:item=><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.category} · {item.unit_type}</p></div>},
    {key:"central",header:"Central Stock",align:"right",className:columnWidth,render:item=>item.central_stock},
    ...branches.map(branch=>({key:branch.id,header:branch.name,align:"right" as const,className:columnWidth,render:(item:BranchStockItem)=>item.branch_stock[branch.id]??"—"})),
  ];
  function change(set:(value:string)=>void){return(value:string)=>{set(value);setPage(0);};}
  return <div className="mx-auto max-w-[1400px] space-y-5">
    <PageHeader title="Branch Stock" subtitle="Compare central kitchen stock with each branch’s inventory. Read-only; refreshes every 30 seconds." actions={<Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className="size-4"/>Refresh</Button>}/>
    {(error||locations.error)&&<Banner tone="danger">{error||locations.error}</Banner>}
    <FilterBar columns={3}>
      <CatalogFilters inline id="branch-stock" search={search} category={category} categories={data?.categories??[]} onSearch={change(setSearch)} onCategory={change(setCategory)}/>
      <div className="space-y-1.5"><Label htmlFor="branch-stock-branch">Branch</Label><FormSelect id="branch-stock-branch" value={branchId} onChange={change(setBranchId)} options={[{value:"",label:"All branches"},...(locations.data??[]).filter(location=>!location.is_central).map(location=>({value:location.id,label:location.name}))]}/></div>
    </FilterBar>
    {data&&!branches.length&&<Banner tone="info">No branch locations are configured yet.</Banner>}
    <DataTable tableClassName="table-fixed" data={data?.rows??null} columns={columns} loading={loading} rowKey={item=>item.id} emptyTitle="No matching items" emptyBody="Adjust your search or category filter."
      renderCard={item=><><div><h3 className="break-words font-medium">{item.name}</h3><p className="text-xs text-muted-foreground">{item.category} · {item.unit_type}</p></div><div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm"><span>Central Stock</span><strong>{item.central_stock}</strong></div><dl className="grid grid-cols-2 gap-3 text-sm">{branches.map(branch=><div key={branch.id} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{branch.name}</dt><dd className="mt-1 font-medium tabular-nums">{item.branch_stock[branch.id]??"—"}</dd></div>)}</dl></>}/>
    <Pagination page={data?.page??page} pageSize={PAGE_SIZE} count={data?.count??0} busy={loading} onChange={setPage}/>
    {data&&<p className="text-xs text-muted-foreground">Updated {formatDateTime(data.as_of)}. Branch quantities use the same opening, received, used, wasted and closing calculations as branch inventory. “—” means the item is not tracked at that branch.</p>}
  </div>;
}
