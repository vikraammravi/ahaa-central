import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { activeRole } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/request-origin";

export async function receiptAccess(request: Request) {
  if (request.method !== "GET" && !hasSameOrigin(request)) throw new Error("Request not allowed.");
  const session = await createSupabaseServer();
  const { data: { user } } = await session.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data: profile } = await session.from("profiles").select("role,status,location_id").eq("id", user.id).single();
  const role = activeRole(profile);
  if (role !== "CENTRAL_ADMIN" && role !== "BRANCH_MANAGER") throw new Error("Only active admins and branch managers can access receipts.");
  if (role === "BRANCH_MANAGER" && !profile?.location_id) throw new Error("No branch is assigned to this account.");
  return { db: createSupabaseAdmin(), user, locationId: role === "CENTRAL_ADMIN" ? null : profile!.location_id };
}
export function receiptError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to process receipt.";
  const status = message === "Sign in first." ? 401 : message.includes("Only active") || message === "Request not allowed." ? 403 : 400;
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export const receiptSelection = "id,file_name,category,status,details,warnings,scan_status,created_at";

export function receiptScope<T>(query: T, locationId: string | null): T {
  const filter = query as { eq: (column: string, value: string) => unknown; is: (column: string, value: null) => unknown };
  return (locationId ? filter.eq("location_id", locationId) : filter.is("location_id", null)) as T;
}
