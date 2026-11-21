import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { platformSession, PlatformAccessError } from "@/server/platform/access";
import { notFound, redirect } from "next/navigation";
import SuperadminPage from "./page";

vi.mock("@/server/platform/access", async importOriginal => ({ ...await importOriginal<typeof import("@/server/platform/access")>(), platformSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));
vi.mock("@/features/platform/components/PlatformConsole", () => ({ default: () => null }));

type ConsoleProps = { registrationEnabled: boolean; ownerAssignmentEnabled: boolean; invitationsEnabled: boolean; activationEnabled: boolean; businessAppOrigin: string | null };
async function consoleProps() { return ((await SuperadminPage()) as ReactElement<ConsoleProps>).props; }

beforeEach(() => {
  vi.mocked(platformSession).mockResolvedValue({} as Awaited<ReturnType<typeof platformSession>>);
  vi.stubEnv("BUSINESS_APP_ORIGIN", "https://business.example");
});

it("passes each capability flag to the console only when explicitly enabled", async () => {
  expect(await consoleProps()).toEqual({ registrationEnabled: false, ownerAssignmentEnabled: false, invitationsEnabled: false, activationEnabled: false, businessAppOrigin: "https://business.example" });
  for (const flag of ["PLATFORM_BUSINESS_REGISTRATION_ENABLED", "PLATFORM_OWNER_ASSIGNMENT_ENABLED", "PLATFORM_OWNER_INVITATIONS_ENABLED", "PLATFORM_BUSINESS_ACTIVATION_ENABLED"]) vi.stubEnv(flag, "true");
  expect(await consoleProps()).toEqual(expect.objectContaining({ registrationEnabled: true, ownerAssignmentEnabled: true, invitationsEnabled: true, activationEnabled: true }));
});

it.each([
  ["http://localhost:3000", "development", "http://localhost:3000"],
  ["http://127.0.0.1:3000", "test", "http://127.0.0.1:3000"],
  ["http://localhost:3000", "production", null],
  ["http://127.0.0.1:3000", "production", null],
  ["https://business.example", "production", "https://business.example"],
  ["http://business.example", "development", null],
  ["https://business.example/path", "development", null],
  ["https://user:secret@business.example", "development", null],
  ["https://business.example/?next=x", "development", null],
  ["not a url", "development", null],
])("shows business app origin %s under NODE_ENV=%s as %s", async (origin, nodeEnv, expected) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("BUSINESS_APP_ORIGIN", origin);
  expect((await consoleProps()).businessAppOrigin).toBe(expected);
});

it("redirects signed-out visitors to sign in and hides the console from everyone else", async () => {
  vi.mocked(platformSession).mockRejectedValueOnce(new PlatformAccessError("Sign in to continue.", 401));
  await expect(SuperadminPage()).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/login?next=/superadmin");
  for (const status of [403, 404]) {
    vi.mocked(platformSession).mockRejectedValueOnce(new PlatformAccessError("Denied.", status));
    await expect(SuperadminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  }
  expect(notFound).toHaveBeenCalledTimes(2);
});
