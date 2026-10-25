"use client";
import { useCallback } from "react";
import { supabase } from "./supabase/client";
import { useAsyncData } from "./useAsyncData";
import type { CatalogOption, CatalogOptions } from "./catalog-options";

export function useCatalogOptions() {
  const load = useCallback(async (signal: AbortSignal): Promise<CatalogOptions> => {
    const results = await Promise.all([
      supabase.from("catalog_categories").select("id,name,is_active,ever_used").order("name").abortSignal(signal),
      supabase.from("catalog_units").select("id,name,is_active,ever_used").order("name").abortSignal(signal),
    ]);
    for (const result of results) if (result.error) throw new Error(result.error.message);
    return { categories: results[0].data as CatalogOption[], units: results[1].data as CatalogOption[] };
  }, []);
  return useAsyncData(load);
}
