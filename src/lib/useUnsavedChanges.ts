"use client";
import { useEffect,useRef } from "react";
import { confirmAction } from "./confirmation";

export function useUnsavedChanges(dirty:boolean,message:string,busy=false,editing=false) {
  const resumeClick=useRef(false);
  const allowUnload=useRef(false);
  useEffect(()=>{
    if(!dirty&&!busy&&!editing)return;
    const unload=(event:BeforeUnloadEvent)=>{if(allowUnload.current)return;event.preventDefault();event.returnValue="";};
    const navigate=async(event:MouseEvent)=>{
      if(resumeClick.current){resumeClick.current=false;return;}
      const anchor=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!(anchor instanceof HTMLAnchorElement)||anchor.getAttribute("href")?.startsWith("#")||anchor.target==="_blank"||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!/^https?:$/.test(anchor.protocol))return;
      event.preventDefault();event.stopPropagation();
      if(busy)return;
      const confirmed=await confirmAction({title:"Unsaved changes",description:message,confirmLabel:"Leave Page",cancelLabel:"Keep Editing"});
      if(!confirmed||!anchor.isConnected)return;
      if(anchor.origin!==window.location.origin){allowUnload.current=true;window.location.assign(anchor.href);return;}
      resumeClick.current=true;anchor.click();
    };
    window.addEventListener("beforeunload",unload);
    document.addEventListener("click",navigate,true);
    return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",navigate,true);};
  },[dirty,message,busy,editing]);
  return async()=>!busy&&(!dirty||await confirmAction({title:"Unsaved changes",description:message,confirmLabel:"Discard Changes",cancelLabel:"Keep Editing"}));
}
