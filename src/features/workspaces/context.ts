import type { Profile } from "@/lib/supabase/types";
import { activeRole } from "@/lib/auth";

export const BUSINESS_COOKIE = "ahaa_business";
export const BUSINESS_HEADER = "x-business-id";
export type Business = { id: string; name: string; slug: string; settings: Record<string, unknown> };
export type Workspace = { business: Business; profile: Profile };
export function businessWorkspacesEnabled() { return process.env.NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED === "true"; }
export function validBusinessId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
/** Selection is a preference, never proof of membership. The database authorizes it. */
export function selectedBusiness(cookie: string): string | null {
  const matches = cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(BUSINESS_COOKIE + "="));
  if (!matches.length) return null;
  if (matches.length !== 1) throw new Error("Invalid workspace selection.");
  let value: string;
  try { value = decodeURIComponent(matches[0].slice(BUSINESS_COOKIE.length + 1)); }
  catch { throw new Error("Invalid workspace selection."); }
  if (!validBusinessId(value)) throw new Error("Invalid workspace selection.");
  return value;
}
export function parseWorkspace(value: unknown, userId: string): Workspace {
  if (!value || typeof value !== "object") throw new Error("Workspace access is unavailable.");
  const { business, profile } = value as Partial<Workspace>;
  if (!business || !validBusinessId(business.id) || typeof business.name !== "string" || typeof business.slug !== "string"
    || !business.settings || typeof business.settings !== "object" || Array.isArray(business.settings)
    || !profile || profile.id !== userId || !activeRole(profile)
    || (profile.role !== "CENTRAL_ADMIN" && (!profile.location_id || !validBusinessId(profile.location_id)))) {
    throw new Error("Workspace access is unavailable.");
  }
  return { business, profile };
}
