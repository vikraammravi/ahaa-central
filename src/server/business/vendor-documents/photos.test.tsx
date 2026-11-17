// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { photosToPdf } from "./photos";

it("produces a PDF containing both selected photos as separate pages", async () => {
  const image = readFileSync("public/aaha-logo.png");
  const pdf = await photosToPdf([{ bytes: image, type: "image/png" }, { bytes: image, type: "image/png" }]);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [])).toHaveLength(2);
});

it("rejects an image with a valid header but corrupted contents", async () => {
  const image = readFileSync("public/aaha-logo.png");
  await expect(photosToPdf([{ bytes: image.subarray(0, 32), type: "image/png" }, { bytes: image, type: "image/png" }])).rejects.toThrow();
});

it("rejects oversized image dimensions before decoding", async () => {
  const image = Buffer.from(readFileSync("public/aaha-logo.png"));
  image.writeUInt32BE(5000, 16);
  image.writeUInt32BE(5000, 20);
  await expect(photosToPdf([{ bytes: image, type: "image/png" }])).rejects.toThrow("20 megapixels");
});
