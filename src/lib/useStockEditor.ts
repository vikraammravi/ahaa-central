"use client";

import { useState } from "react";
import { useUnsavedChanges } from "./useUnsavedChanges";
import { supabase } from "@/lib/supabase/client";
import type { CatalogItem } from "@/lib/supabase/types";

type StockUpdate={id:string;available_stock:number;expected_stock:number;expected_updated_at:string};
const warning="You have stock changes that have not been broadcast. Leave and discard them?";

export function useStockEditor(items:CatalogItem[]|null,onBroadcast:()=>void) {
  const [snapshot,setSnapshot]=useState<CatalogItem[]|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});
  const [pending,setPending]=useState<StockUpdate[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const editing=snapshot!==null;
  const changed=!!snapshot?.some(item=>values[item.id]!==String(pending.find(update=>update.id===item.id)?.available_stock??item.available_stock));
  const dirty=changed||pending.length>0;

  useUnsavedChanges(dirty,warning,saving,editing);

  function edit(){
    if(!items||saving)return;
    setSnapshot(items);
    setValues(Object.fromEntries(items.map(item=>[item.id,String(pending.find(update=>update.id===item.id)?.available_stock??item.available_stock)])));
    setError(null);
  }
  function save(){
    if(!snapshot||saving)return;
    const updates:StockUpdate[]=[];
    for(const item of snapshot){
      const value=values[item.id];const quantity=Number(value);
      if(!/^\d+$/.test(value)||!Number.isSafeInteger(quantity)||quantity>2147483647){setError("Stock must be a nonnegative whole number.");return;}
      const previous=pending.find(update=>update.id===item.id);
      const expected_stock=previous?.expected_stock??item.available_stock;
      if(quantity!==expected_stock)updates.push({id:item.id,available_stock:quantity,expected_stock,expected_updated_at:previous?.expected_updated_at??item.updated_at});
    }
    setPending(updates);setSnapshot(null);setValues({});setError(null);
  }
  function cancel(){
    if(changed&&!window.confirm("Discard your unsaved edits? Previously saved changes will remain pending broadcast."))return;
    setSnapshot(null);setValues({});setError(null);
  }
  function discard(){
    if(dirty&&!window.confirm(warning))return;
    setSnapshot(null);setValues({});setPending([]);setError(null);
  }
  async function broadcast(){
    if(editing||saving||!pending.length)return;
    setSaving(true);setError(null);
    try{
      const {error}=await supabase.rpc("save_daily_stock",{p_updates:pending});
      if(error)throw new Error(error.message);
      setPending([]);onBroadcast();
    }catch(error){setError(error instanceof Error?error.message:"Unable to broadcast stock.");}
    finally{setSaving(false);}
  }
  return {items:snapshot??items,editing,values,pending,saving,error,edit,save,cancel,discard,broadcast,
    setValue:(id:string,value:string)=>setValues(previous=>({...previous,[id]:value})),
    quantity:(item:CatalogItem)=>pending.find(update=>update.id===item.id)?.available_stock??item.available_stock};
}
