import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";
import { workspaceFetch } from "@/features/workspaces/fetch";

// Browser Supabase client for use in Client Components.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: workspaceFetch } });
