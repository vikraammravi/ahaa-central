import { BUSINESS_HEADER, businessWorkspacesEnabled, selectedBusiness } from "./context";
import { SUPABASE_URL } from "@/lib/supabase/env";
let displayedBusiness: string | null = null;
export function setDisplayedBusiness(id: string | null) { displayedBusiness = id; }

/** Restrict the preference header to our own data/storage endpoints. */
export async function workspaceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!businessWorkspacesEnabled() || typeof document === "undefined") return fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== new URL(SUPABASE_URL).origin || !/^\/(rest|storage)\/v1\//.test(url.pathname)) return fetch(input, init);
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  // A missing selection must not preserve a stale header from an earlier workspace.
  headers.delete(BUSINESS_HEADER);
  const choosing = url.pathname === "/rest/v1/rpc/my_workspaces";
  const resolving = url.pathname === "/rest/v1/rpc/current_workspace";
  const businessId = choosing ? null : selectedBusiness(document.cookie);
  if (!choosing && !resolving && displayedBusiness && businessId !== displayedBusiness) throw new Error("Workspace changed. Reload before continuing.");
  if (businessId) headers.set(BUSINESS_HEADER, businessId);
  const response = await fetch(input, { ...init, headers });
  if (!choosing && businessId !== selectedBusiness(document.cookie)) throw new Error("Workspace changed. Reload before continuing.");
  return response;
}
