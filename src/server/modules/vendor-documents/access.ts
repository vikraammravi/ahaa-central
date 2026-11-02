import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { activeRole } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/request-origin";
import { loadSessionProfile } from "@/features/workspaces/session";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";

export async function receiptAccess(request: Request) {
  if (request.method !== "GET" && !hasSameOrigin(request)) throw new Error("Request not allowed.");
  const session = await createSupabaseServer();
  const { data: { user } } = await session.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { profile, business, error } = await loadSessionProfile(session, user.id);
  if (error) throw new Error(error.message);
  const role = activeRole(profile);
  if (role !== "CENTRAL_ADMIN" && role !== "BRANCH_MANAGER") throw new Error("Only active admins and branch managers can access receipts.");
  if (role === "BRANCH_MANAGER" && !profile?.location_id) throw new Error("No branch is assigned to this account.");
  return { db: createSupabaseAdmin(), user, businessId: business?.id ?? null, locationId: role === "CENTRAL_ADMIN" ? null : profile!.location_id };
}
export function receiptError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process receipt.";
  const status = message === "Sign in first." ? 401 : message.includes("Only active") || message === "Request not allowed." || message.includes("Workspace access") || message === "Choose a workspace" ? 403 : 400;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export const receiptSelection = "id,file_name,category,status,details,warnings,scan_status,created_at";

export function receiptScope<T>(query: T, locationId: string | null, businessId?: string | null): T {
  type Filter = { eq: (column: string, value: string) => unknown; is: (column: string, value: null) => unknown };
  let scoped = query;
  if (businessWorkspacesEnabled()) {
    if (!businessId) throw new Error("Workspace access is unavailable.");
    scoped = (query as Filter).eq("business_id", businessId) as T;
  }
  const filter = scoped as Filter;
  return (locationId ? filter.eq("location_id", locationId) : filter.is("location_id", null)) as T;
}
