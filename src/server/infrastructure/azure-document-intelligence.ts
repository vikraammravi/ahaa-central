import "server-only";

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

export async function readDocumentScan(operationUrl: string) {
  const { endpoint, key } = azureConfig();
  const operation = new URL(operationUrl);
  if (operation.origin !== endpoint || !operation.pathname.startsWith("/documentintelligence/documentModels/")) throw new Error("Invalid scan operation.");
  const response = await fetch(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw azureFailure(response.status);
  return response.json();
}

export async function startDocumentScan(endpoint: string, key: string, model: string, file: Blob) {
  const response = await fetch(`${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=2024-11-30&pages=1-2`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream" }, body: await file.arrayBuffer(), redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw azureFailure(response.status);
  const location = response.headers.get("operation-location");
  if (!location || new URL(location).origin !== endpoint) throw new Error("Azure did not return a valid scan operation.");
  return location;
}
