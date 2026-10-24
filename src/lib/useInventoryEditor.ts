"use client";
import { useState } from "react";
import { inventoryDraft,inventoryDayError,updateInventoryDraft,type InventoryDraft,type InventoryWorkspace } from "./inventory";
import { supabase } from "./supabase/client";
import { useUnsavedChanges } from "./useUnsavedChanges";

export function useInventoryEditor(data:InventoryWorkspace|null,onSaved:()=>void) {
  const [workspace,setWorkspace]=useState<InventoryWorkspace|null>(null);
  const [drafts,setDrafts]=useState<Record<string,InventoryDraft>>({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const dirty=!!workspace&&workspace.items.some(item=>{
    const original=inventoryDraft(item),draft=drafts[item.id];
    return (["opening","used","wasted","closing"] as const).some(field=>draft[field]!==original[field]);
  });
  const mayLeave=useUnsavedChanges(dirty,"Your inventory changes have not been saved. Leaving this page will discard them.",saving,!!workspace);
  function edit(){
    if(!data||saving)return;
    setWorkspace(data);setDrafts(Object.fromEntries(data.items.map(item=>[item.id,inventoryDraft(item)])));setError(null);
  }
  async function cancel(){if(!await mayLeave())return false;setWorkspace(null);setError(null);return true;}
  async function save(){
    if(!workspace||saving)return;
    const notes=workspace.current?.notes??"";
    const validation=inventoryDayError(workspace.items,drafts);
    if(validation){setError(validation);return;}
    setSaving(true);setError(null);
    try{
      const {error}=await supabase.rpc("save_branch_inventory_day",{
        p_count_date:workspace.count_date,p_expected_count_id:workspace.expected_count_id,p_expected_previous_count_id:workspace.expected_previous_count_id,p_notes:notes,
        p_lines:workspace.items.map(item=>({item_id:item.id,opening_quantity:Number(drafts[item.id].opening),used_quantity:Number(drafts[item.id].used),wasted_quantity:Number(drafts[item.id].wasted),quantity:Number(drafts[item.id].closing),expected_opening_quantity:item.opening_quantity,expected_received_quantity:item.received_quantity})),
      });
      if(error)throw new Error(error.message);
      setWorkspace(null);onSaved();
    }catch(error){setError(error instanceof Error?error.message:"Unable to save inventory.");}
    finally{setSaving(false);}
  }
  return {workspace,drafts,saving,error,edit,cancel,save,
    update:(id:string,field:"wasted"|"closing",value:string)=>{
      const item=workspace?.items.find(item=>item.id===id);if(!item)return;
      setDrafts(previous=>({...previous,[id]:updateInventoryDraft(item,previous[id],field,value)}));
    }};
}
