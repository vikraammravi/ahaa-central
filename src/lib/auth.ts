import type { UserRole } from "./supabase/types";

export function activeRole(profile: { role?: string | null; status?: string | null } | null): UserRole | null {
  if (profile?.status !== "active") return null;
  return profile.role === "CENTRAL_ADMIN" || profile.role === "BRANCH_MANAGER" ? profile.role : null;
}

export function userHome(role: UserRole): string {
  return role === "CENTRAL_ADMIN" ? "/admin/dashboard" : "/branch/home";
}

export function safeNextPath(next: string | null, role: UserRole): string {
  const prefix = role === "CENTRAL_ADMIN" ? "/admin" : "/branch";
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\r\n]/.test(next)) return userHome(role);
  try {
    const url = new URL(next, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || !(url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return userHome(role);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return userHome(role); }
}

export function userInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}
