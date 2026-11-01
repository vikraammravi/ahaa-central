import { createHash } from "node:crypto";
import { receiptAccess, receiptError, receiptSelection, receiptScope } from "@/lib/receipt-server";
import { emptyReceipt, receiptFilters } from "@/lib/receipts";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { db, locationId } = await receiptAccess(request);
    const page = Math.floor(Math.max(0, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 0)));
    const filters = receiptFilters(new URL(request.url).searchParams);
    let query = receiptScope(db.from("purchase_receipts").select(receiptSelection, { count: "exact" }), locationId).is("deleted_at", null);
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.search) query = query.or(`details->>vendor.ilike.*${filters.search}*,details->>invoiceNumber.ilike.*${filters.search}*`);
    const { data, count, error } = await query.order("created_at", { ascending: false }).order("id").range(page * 25, page * 25 + 24);
    if (error) throw new Error("Receipt storage is unavailable. Check that the purchase receipts migration has been applied.");
    return Response.json({ rows: data, count }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return receiptError(error); }
}
export async function POST(request: Request) {
  try {
    const { db, user, locationId } = await receiptAccess(request);
    if (Number(request.headers.get("content-length")) > 4200000) throw new Error("Use a PDF, JPG or PNG under 4 MB.");
    const form = await request.formData();
    const file = form.get("file");
    const model = form.get("model");
    if (!(file instanceof File) || !file.size || file.size > 4000000 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) throw new Error("Use a PDF, JPG or PNG under 4 MB.");
    if (model !== "prebuilt-invoice" && model !== "prebuilt-receipt") throw new Error("Choose invoice or receipt.");
    const bytes = Buffer.from(await file.arrayBuffer());
    const matches = file.type === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : file.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!matches) throw new Error("The file contents do not match its format.");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const { data: existing, error: lookupError } = await receiptScope(db.from("purchase_receipts").select(`${receiptSelection},deleted_at`), locationId).eq("file_hash", hash).maybeSingle();
    if (lookupError) throw new Error("Receipt storage is unavailable. Apply the purchase receipts migration first.");
    if (existing) {
      if (existing.deleted_at) {
        const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
        const { error: retryUploadError } = await db.storage.from("purchase-receipts").upload(existing.id + "/original." + extension, bytes, { contentType: file.type, upsert: true });
        if (retryUploadError) throw new Error("Unable to restore the original file. Try again later.");
        const { data: restored, error: restoreError } = await db.from("purchase_receipts").update({ deleted_at: null, updated_at: new Date().toISOString() }).eq("id", existing.id).select(receiptSelection).single();
        if (restoreError) throw new Error("Unable to restore the existing invoice.");
        return Response.json({ receipt: restored, duplicate: true, restored: true });
      }
      return Response.json({ receipt: existing, duplicate: true });
    }
    const id = crypto.randomUUID();
    const path = `${id}/original.${file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg"}`;
    const { data: reserved, error: reserveError } = await db.rpc("create_purchase_receipt", { p_id: id, p_user_id: user.id, p_file_name: file.name.slice(0, 250), p_file_path: path, p_file_hash: hash, p_model: model });
    if (reserveError || !reserved) throw new Error("Unable to create invoice. This file may already exist; refresh the list before retrying.");
    const { error: uploadError } = await db.storage.from("purchase-receipts").upload(path, bytes, { contentType: file.type });
    if (uploadError) {
      await db.from("purchase_receipts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      throw new Error("Unable to store the original receipt. Try again later.");
    }
    const { data, error } = await db.from("purchase_receipts").update({ details: emptyReceipt() }).eq("id", id).select(receiptSelection).single();
    if (error) {

      throw new Error("Unable to create receipt. It may already have been uploaded; refresh the list.");
    }
    return Response.json({ receipt: data }, { status: 201 });
  } catch (error) { return receiptError(error); }
}
