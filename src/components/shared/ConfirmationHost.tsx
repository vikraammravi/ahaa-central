"use client";
import { useEffect,useSyncExternalStore } from "react";
import { getConfirmation,settleConfirmation,subscribeConfirmation } from "@/lib/confirmation";
import { ConfirmDialog } from "./ConfirmDialog";

export function ConfirmationHost(){
  const pending=useSyncExternalStore(subscribeConfirmation,getConfirmation,()=>null);
  useEffect(()=>()=>settleConfirmation(false),[]);
  if(!pending)return null;
  return <ConfirmDialog key={pending.id} open title={pending.title} description={pending.description} confirmLabel={pending.confirmLabel??"Discard Changes"} cancelLabel={pending.cancelLabel??"Keep Editing"} tone={pending.tone??"danger"} onConfirm={()=>settleConfirmation(true)} onOpenChange={open=>{if(!open)settleConfirmation(false);}}/>;
}
