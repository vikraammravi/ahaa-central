import { supabase } from "@/lib/supabase/client";
import { parseWorkspace, selectedBusiness, validBusinessId, WORKSPACE_CHANGED_EVENT } from "./context";
import { saveBusinessSelection } from "./selection";
import { setDisplayedBusiness } from "./fetch";
import type { ProfileStatus, UserRole } from "@/lib/supabase/types";

export type WorkspaceChoice = { business_id: string; name: string; slug: string; role: UserRole; status: ProfileStatus; business_status: string; isolation_ready: boolean };
export async function fetchWorkspaceChoices(signal: AbortSignal): Promise<WorkspaceChoice[]> {
  const { error, data } = await supabase.rpc("my_workspaces").abortSignal(signal);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("Unable to load your workspaces.");
  return data as WorkspaceChoice[];
}
export async function chooseWorkspace(id: string) {
  if (!validBusinessId(id)) throw new Error("Invalid workspace selection.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in first.");
  // Do not restore a revoked selection after a failed authorization attempt.
  saveBusinessSelection(id);
  try {
    const result = await supabase.rpc("current_workspace");
    if (result.error) throw new Error(result.error.message);
    const workspace = parseWorkspace(result.data, user.id);
    if (workspace.business.id !== id) throw new Error("Workspace selection could not be verified.");
    setDisplayedBusiness(id);
    window.dispatchEvent(new Event(WORKSPACE_CHANGED_EVENT));
    return workspace;
  } catch (error) {
    // A newer selection in another tab or request must survive this failure.
    try {
      const currentSelection = selectedBusiness(document.cookie);
      if (currentSelection === id || currentSelection === null) {
        if (currentSelection === id) saveBusinessSelection(null);
        setDisplayedBusiness(null);
      }
    } catch {
      saveBusinessSelection(null);
      setDisplayedBusiness(null);
    }
    throw error;
  }
}
