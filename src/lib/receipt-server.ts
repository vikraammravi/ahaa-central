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
export function azureConfig() {
  if (process.env.AZURE_DOCUMENT_SCANNING_ENABLED !== "true") throw new Error("AI scanning is temporarily disabled. Manual invoice entry remains available.");
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) throw new Error("Azure scanning is not configured on the server.");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cognitiveservices.azure.com")) throw new Error("Invalid Azure endpoint configuration.");
  return { endpoint: url.origin, key };
}
export function azureFailure(status: number): Error {
  return new Error(status === 401 ? "Azure rejected the server key. Check the scanner configuration." : status === 403 ? "Azure blocked access. Check the resource network/firewall settings and server key." : status === 429 ? "Azure is busy or its quota has been reached. Try later; manual entry is still available." : "Azure could not scan this file. Try a clearer PDF/photo or enter details manually.");
}
export const receiptSelection = "id,file_name,category,status,details,warnings,scan_status,created_at";

export function receiptScope<T>(query: T, locationId: string | null): T {
  const filter = query as { eq: (column: string, value: string) => unknown; is: (column: string, value: null) => unknown };
  return (locationId ? filter.eq("location_id", locationId) : filter.is("location_id", null)) as T;
}
