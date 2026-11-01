import { expect, it } from "vitest";
import { hasSameOrigin } from "./request-origin";

it("accepts the browser host when Next uses an internal localhost URL", () => {
  expect(hasSameOrigin(new Request("http://localhost:3000/api/admin/receipts", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  }))).toBe(true);
});

it.each([undefined, "https://other.example", "http://127.0.0.1:3001", "https://127.0.0.1:3000"])(
  "rejects missing or mismatched browser origins: %s",
  (origin) => {
    expect(hasSameOrigin(new Request("http://localhost:3000/api/admin/receipts", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) },
    }))).toBe(false);
  },
);

it("uses the request URL when no Host header is present", () => {
  expect(hasSameOrigin(new Request("https://app.example/api/admin/receipts", {
    headers: { origin: "https://app.example" },
  }))).toBe(true);
});
