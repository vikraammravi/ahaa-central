import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_KEY } from "./env";
import { BUSINESS_COOKIE, BUSINESS_HEADER, businessWorkspacesEnabled, selectedBusiness } from "@/features/workspaces/context";

// Server Supabase client for Server Components, Route Handlers, Server Actions.
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const selection = businessWorkspacesEnabled() ? selectedBusiness(cookieStore.getAll().filter(cookie => cookie.name === BUSINESS_COOKIE).map(cookie => `${cookie.name}=${cookie.value}`).join(";")) : null;
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: selection ? { [BUSINESS_HEADER]: selection } : {} },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
