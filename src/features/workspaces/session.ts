import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";
import { businessWorkspacesEnabled, parseWorkspace, type Business } from "./context";

type Database = Pick<SupabaseClient, "from" | "rpc">;
export async function loadSessionProfile(db: Database, userId: string, signal?: AbortSignal): Promise<{
  profile: Profile | null; business: Business | null; error: { message: string } | null;
}> {
  if (!businessWorkspacesEnabled()) {
    let query = db.from("profiles").select("*").eq("id", userId);
    if (signal) query = query.abortSignal(signal);
    const result = await query.single();
    return { profile: result.data as Profile | null, business: null, error: result.error };
  }
  let query = db.rpc("current_workspace");
  if (signal) query = query.abortSignal(signal);
  const result = await query;
  if (result.error) return { profile: null, business: null, error: result.error };
  try { return { ...parseWorkspace(result.data, userId), error: null }; }
  catch (error) { return { profile: null, business: null, error: { message: error instanceof Error ? error.message : "Workspace access is unavailable." } }; }
}
