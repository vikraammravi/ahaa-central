import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workspaceFetch } from "./fetch";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { businessId } from "@tests/mocks/workspaces";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  document.cookie = `ahaa_business=${businessId}; path=/`;
  vi.mocked(fetch).mockResolvedValue(new Response("{}"));
});
afterEach(() => { document.cookie = "ahaa_business=; Max-Age=0; path=/"; });
it("forwards selection only to this project's data endpoints and preserves request options", async () => {
  const signal = new AbortController().signal;
  await workspaceFetch(SUPABASE_URL + "/rest/v1/orders", { headers: { Authorization: "Bearer test", "x-business-id": "stale" }, signal });
  const init = vi.mocked(fetch).mock.calls[0][1]!;
  expect(new Headers(init.headers).get("x-business-id")).toBe(businessId);
  expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test");
  expect(init.signal).toBe(signal);
});
it("does not transmit business selection to external hosts or authentication endpoints", async () => {
  for (const url of ["https://other.test/rest/v1/orders", SUPABASE_URL + "/auth/v1/user"]) {
    await workspaceFetch(url);
  }
  expect(vi.mocked(fetch).mock.calls.every(call => !call[1]?.headers)).toBe(true);
});
it("rejects invalid selection before sending a data request", async () => {
  document.cookie = "ahaa_business=invalid; path=/";
  await expect(workspaceFetch(SUPABASE_URL + "/rest/v1/orders")).rejects.toThrow("Invalid workspace");
  expect(fetch).not.toHaveBeenCalled();
});
