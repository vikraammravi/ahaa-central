import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import type { BranchUserRole } from "@/features/users/domain";
import { businessWorkspacesEnabled, WORKSPACE_CHANGED_EVENT } from "@/features/workspaces/context";

export type NewBranchUser = {
  fullName: string; email: string; password: string; locationId: string; role: BranchUserRole;
};

async function accountRequest(path: string, method: "POST" | "DELETE" | "PATCH", body?: NewBranchUser | Pick<Profile, "full_name" | "phone" | "role" | "status" | "location_id">): Promise<void> {
  const response = await fetch(path, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to update the account.");
}

export function createBranchUser(input: NewBranchUser): Promise<void> {
  return accountRequest("/api/admin/branch-users", "POST", input);
}

export function deleteUserAccount(id: string): Promise<void> {
  return accountRequest(`/api/admin/users/${encodeURIComponent(id)}`, "DELETE");
}

export async function updateUserProfile(id: string, changes: Pick<Profile, "full_name" | "phone" | "role" | "status" | "location_id">): Promise<void> {
  if (businessWorkspacesEnabled()) {
    await accountRequest(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", changes);
    window.dispatchEvent(new Event(WORKSPACE_CHANGED_EVENT));
    return;
  }
  const { error } = await supabase.from("profiles").update(changes).eq("id", id);
  if (error) throw new Error(error.message);
}
