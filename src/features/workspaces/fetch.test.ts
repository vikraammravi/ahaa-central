import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workspaceFetch, setDisplayedBusiness } from "./fetch";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { businessId, otherBusinessId } from "@tests/mocks/workspaces";

beforeEach(() => {
  setDisplayedBusiness(null);
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED", "true");
  document.cookie = `ahaa_business=${businessId}; path=/`;
  vi.mocked(fetch).mockResolvedValue(new Response("{}"));
});
afterEach(() => { document.cookie = "ahaa_business=; Max-Age=0; path=/"; setDisplayedBusiness(null); });
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
it("blocks stale-page writes after another tab changes the selected business", async () => {
  setDisplayedBusiness(businessId);
  document.cookie = `ahaa_business=${otherBusinessId}; path=/`;
  await expect(workspaceFetch(SUPABASE_URL + "/rest/v1/orders", { method: "POST" })).rejects.toThrow("Workspace changed");
  expect(fetch).not.toHaveBeenCalled();
  await workspaceFetch(SUPABASE_URL + "/rest/v1/rpc/current_workspace", { method: "POST" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("discards a response if the workspace changes while it is in flight", async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const request = workspaceFetch(SUPABASE_URL + "/rest/v1/orders");
  document.cookie = `ahaa_business=${otherBusinessId}; path=/`;
  finish(new Response("[]"));
  await expect(request).rejects.toThrow("Workspace changed");
});
it("allows the chooser to recover from a malformed selection without forwarding it", async () => {
  document.cookie = "ahaa_business=invalid; path=/";
  await workspaceFetch(SUPABASE_URL + "/rest/v1/rpc/my_workspaces", { method: "POST" });
  expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has("x-business-id")).toBe(false);
});
