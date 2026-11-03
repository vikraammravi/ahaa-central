export type PlatformBusiness = { id: string; name: string; slug: string; status: "provisioning" | "active" | "suspended"; isolation_ready: boolean; owner_assigned: boolean; created_at: string };
export async function fetchBusinesses(signal: AbortSignal): Promise<PlatformBusiness[]> {
  const response = await fetch("/api/platform/businesses", { signal, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load businesses.");
  return result.businesses;
}
export async function registerBusiness(name: string, slug: string): Promise<void> {
  const response = await fetch("/api/platform/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, slug }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to create business.");
}
export async function assignBusinessOwner(businessId: string, email: string): Promise<void> {
  const response = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}/owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to assign the business admin.");
}
export async function createBusinessOwner(businessId: string, name: string, email: string, password: string): Promise<void> {
  const response = await fetch(`/api/platform/businesses/${encodeURIComponent(businessId)}/owner/new`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to create the business admin.");
}
