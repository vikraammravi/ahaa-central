import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PLATFORM_CONSOLE_TITLE, PLATFORM_NAME } from "../brand";
import { PlatformBrand } from "./PlatformBrand";

it("uses a platform identity that is not Ahaa branding", () => {
  expect(PLATFORM_NAME).toBe("Kitchen Ops Cloud");
  expect(PLATFORM_CONSOLE_TITLE).toBe("Kitchen Ops Cloud · Admin");
  expect(`${PLATFORM_NAME} ${PLATFORM_CONSOLE_TITLE}`).not.toMatch(/ahaa|aaha|truly south/i);
});

it("renders the wordmark with an optional subtitle and a decorative icon", () => {
  const { container, rerender } = render(<PlatformBrand />);
  expect(screen.getByText(PLATFORM_NAME)).toBeInTheDocument();
  expect(container.textContent).toBe(PLATFORM_NAME);
  expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  rerender(<PlatformBrand subtitle="Superadmin" tone="inverse" />);
  expect(screen.getByText("Superadmin")).toBeInTheDocument();
  expect(screen.getByText(PLATFORM_NAME)).toHaveClass("text-white");
});
