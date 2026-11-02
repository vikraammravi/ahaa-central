import { supabase } from "@/lib/supabase/client";
import type {Location} from "@/lib/supabase/types";
export async function fetchLocations(signal: AbortSignal): Promise<Location[]> {
  const { data, error } = await supabase.from("locations").select("*").order("name").abortSignal(signal);
  if (error) throw new Error(error.message);
  return (data ?? []) as Location[];
}
