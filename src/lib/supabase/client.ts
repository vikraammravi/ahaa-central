import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";

// Browser Supabase client for use in Client Components.
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
