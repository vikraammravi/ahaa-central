import "server-only";
import { Document, Image, Page, renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";

// Read dimensions before decoding to avoid excessive memory use from compressed images.
function imageDimensions(bytes: Buffer, type: string): [number, number] | null {
  if (type === "image/png") {
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (type !== "image/jpeg" || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  return null;
}

export async function photosToPdf(photos: { bytes: Buffer; type: string }[]): Promise<Buffer> {
  for (const photo of photos) {
    const size = imageDimensions(photo.bytes, photo.type);
    if (!size || size.some(n => n < 50 || n > 10000) || size[0] * size[1] > 20_000_000) throw new Error("Use valid JPG or PNG photos between 50 and 10,000 pixels, up to 20 megapixels each.");
  }
  try {
    // Decode and normalize before rendering: the PDF renderer may silently omit corrupt images.
    const decoded: typeof photos = [];
    for (const photo of photos) {
      const image = sharp(photo.bytes, { failOn: "warning", limitInputPixels: 20_000_000 }).rotate();
      const bytes = await (photo.type === "image/png" ? image.png() : image.jpeg({ quality: 95 })).toBuffer();
      decoded.push({ ...photo, bytes });
    }
    // react-pdf's Image is not an HTML image and does not support an alt property.
    // eslint-disable-next-line jsx-a11y/alt-text
    return await renderToBuffer(<Document>{decoded.map((photo, index) => <Page key={index} size="A4" style={{ padding: 12 }}><Image src={`data:${photo.type};base64,${photo.bytes.toString("base64")}`} style={{ width: 571, height: 817, objectFit: "contain" }} /></Page>)}</Document>);
  } catch {
    throw new Error("Unable to read the photos. Please use valid JPG or PNG images.");
  }
}
