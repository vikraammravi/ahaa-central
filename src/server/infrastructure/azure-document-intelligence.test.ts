import { beforeEach, expect, it, vi } from "vitest";
import { azureConfig, readDocumentScan, startDocumentScan } from "./azure-document-intelligence";

const endpoint = "https://receipt-test.cognitiveservices.azure.com";
beforeEach(() => {
  vi.stubEnv("AZURE_DOCUMENT_SCANNING_ENABLED", "true");
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", endpoint);
  vi.stubEnv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "test-only");
});

it("blocks polling without contacting Azure when scanning is disabled", async () => {
  vi.stubEnv("AZURE_DOCUMENT_SCANNING_ENABLED", "false");
  await expect(readDocumentScan(endpoint + "/documentintelligence/documentModels/test")).rejects.toThrow("disabled");
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects untrusted operation origins and paths before sending the key", async () => {
  for (const url of ["https://other.test/documentintelligence/documentModels/test", endpoint + "/other"]) {
    await expect(readDocumentScan(url)).rejects.toThrow("Invalid scan operation");
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("retains the two-page scan cap, timeout and redirect protection", async () => {
  const operation = endpoint + "/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/test";
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 202, headers: { "operation-location": operation } }));
  const config = azureConfig();
  await expect(startDocumentScan(config.endpoint, config.key, "prebuilt-invoice", new Blob(["pdf"])) ).resolves.toBe(operation);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("pages=1-2"), expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) }));
});
