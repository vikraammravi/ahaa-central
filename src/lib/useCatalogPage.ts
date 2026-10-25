"use client";
import { useCallback,useState } from "react";
import { useAsyncData } from "./useAsyncData";
import { useDebouncedValue } from "./useDebouncedValue";
import { supabase } from "./supabase/client";
import type { CatalogItem } from "./supabase/types";

export type CatalogPage={rows:CatalogItem[];count:number;page:number;categories:string[]};
export function useCatalogPage({activeOnly=false,pollInterval,overrides={}}:{activeOnly?:boolean;pollInterval?:number;overrides?:Record<string,number>}={}){
  const [search,setSearchValue]=useState("");const [category,setCategoryValue]=useState("");
  const [status,setStatusValue]=useState("all");const [stockStatus,setStockStatusValue]=useState("ALL");const [page,setPage]=useState(0);
  const debounced=useDebouncedValue(search);const encodedOverrides=JSON.stringify(overrides);
  const load=useCallback(async(signal:AbortSignal)=>{
    const {data,error}=await supabase.rpc("catalog_page",{p_page:page,p_search:debounced,p_category:category,p_status:activeOnly?"active":status,p_stock_status:stockStatus,p_stock_overrides:JSON.parse(encodedOverrides)}).abortSignal(signal);
    if(error)throw new Error(error.message);return data as CatalogPage;
  },[page,debounced,category,status,stockStatus,activeOnly,encodedOverrides]);
  const result=useAsyncData(load,{pollInterval});
  function filter(set:(value:string)=>void){return(value:string)=>{set(value);setPage(0);};}
  return {...result,page:result.data?.page??page,setPage,search,category,status,stockStatus,
    categories:Array.from(new Set<string>(result.data?.categories??[])).sort((a,b)=>a.localeCompare(b,"en",{sensitivity:"base"})),
    setSearch:filter(setSearchValue),setCategory:filter(setCategoryValue),setStatus:filter(setStatusValue),setStockStatus:filter(setStockStatusValue)};
}
