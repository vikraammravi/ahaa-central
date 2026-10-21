"use client";
import { useEffect } from "react";

export function useUnsavedChanges(dirty:boolean,message:string,busy=false,editing=false) {
  useEffect(()=>{
    if(!dirty&&!busy&&!editing)return;
    const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    const navigate=(event:MouseEvent)=>{
      const anchor=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!anchor||anchor.getAttribute("href")?.startsWith("#"))return;
      if(busy||!window.confirm(message)){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener("beforeunload",unload);
    document.addEventListener("click",navigate,true);
    return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",navigate,true);};
  },[dirty,message,busy,editing]);
  return ()=>!busy&&(!dirty||window.confirm(message));
}
