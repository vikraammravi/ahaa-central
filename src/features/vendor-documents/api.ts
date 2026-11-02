export async function receiptApi(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to complete receipt request.");
  return result;
}
