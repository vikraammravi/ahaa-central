"use client";
import { useMemo, useState } from "react";
import { CATALOG_CATEGORIES, catalogCategory, matchesCatalogFilter } from "./catalog";
export function useCatalogFilters<T extends {name:string;category:string}>(items:T[]|null) {
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const categories=useMemo(()=>Array.from(new Set<string>([...CATALOG_CATEGORIES,...(items??[]).map(item=>catalogCategory(item.category))])),[items]);
  const filtered=useMemo(()=>items?.filter(item=>matchesCatalogFilter(item,search,category))??null,[items,search,category]);
  return {search,category,categories,filtered,setSearch,setCategory};
}
