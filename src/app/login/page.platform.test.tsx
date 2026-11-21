import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "@/app/login/page";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { PLATFORM_NAME } from "@/features/platform/brand";

// The platform sign-in is reached as /login?next=/superadmin.
vi.mock("next/navigation", async () => {
  const { router: mockRouter } = await import("@tests/mocks/supabase");
  return { useRouter: () => mockRouter, usePathname: () => "/login", useSearchParams: () => new URLSearchParams("next=/superadmin") };
});

it("brands the superadmin sign-in as the platform, not Ahaa", () => {
  render(<Login />);
  expect(screen.getByRole("heading", { name: "Superadmin sign in" })).toBeInTheDocument();
  expect(screen.getAllByText(PLATFORM_NAME).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Platform admin")).toBeInTheDocument();
  expect(screen.getByText(new RegExp(`© \\d{4} ${PLATFORM_NAME}`))).toBeInTheDocument();
  expect(screen.queryByAltText(/Aaha/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Aaha Central")).not.toBeInTheDocument();
  expect(screen.queryByText(/Truly South/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("placeholder", "you@company.com");
});

it("enters the console only for a platform administrator", async () => {
  db.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: "platform-user" } }, error: null });
  db.rpc.mockReturnValueOnce(queryResult(false));
  render(<Login />);
  await userEvent.type(screen.getByLabelText("Email"), "admin@example.invalid");
  await userEvent.type(screen.getByLabelText("Password"), "test-password-123");
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
  expect(await screen.findByText("Platform access is required for this account.")).toBeInTheDocument();
  expect(router.replace).not.toHaveBeenCalled();
  db.rpc.mockReturnValueOnce(queryResult(true));
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
  expect(db.rpc).toHaveBeenCalledWith("platform_is_administrator");
  expect(router.replace).toHaveBeenCalledWith("/superadmin");
});
