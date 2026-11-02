export type PlatformBusiness = { id: string; name: string; slug: string; status: "provisioning" | "active" | "suspended"; isolation_ready: boolean; created_at: string };
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
