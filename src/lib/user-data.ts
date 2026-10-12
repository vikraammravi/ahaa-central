import { supabase } from "./supabase/client";
import type { Profile } from "./supabase/types";
import type { BranchUserRole } from "./users";

export type NewBranchUser = {
  fullName: string; email: string; password: string; locationId: string; role: BranchUserRole;
};

async function accountRequest(path: string, method: "POST" | "DELETE", body?: NewBranchUser): Promise<void> {
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
  const { error } = await supabase.from("profiles").update(changes).eq("id", id);
  if (error) throw new Error(error.message);
}
