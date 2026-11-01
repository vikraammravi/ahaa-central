import { azureConfig, azureFailure, receiptAccess, receiptError, receiptSelection, receiptScope } from "@/lib/receipt-server";
import { expenseCategories, extractReceipt, receiptWarnings, validReceiptDetails } from "@/lib/receipts";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(request: Request, context: Context) {
  try {
    const { db, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const { data: row, error } = await receiptScope(db.from("purchase_receipts").select("*"), locationId).eq("id", id).is("deleted_at", null).single();
    if (error || !row) throw new Error("Receipt not found.");
    if (new URL(request.url).searchParams.get("original") === "1") {
      const { data, error: fileError } = await db.storage.from("purchase-receipts").createSignedUrl(row.file_path, 120);
      if (fileError || !data) throw new Error("Unable to open original receipt.");
      return new Response(null, { status: 307, headers: { Location: data.signedUrl, "Cache-Control": "no-store" } });
    }
    if (row.scan_status === "RUNNING" && row.operation_url) {
      const { endpoint, key } = azureConfig();
      const operation = new URL(row.operation_url);
      if (operation.origin !== endpoint || !operation.pathname.startsWith("/documentintelligence/documentModels/")) throw new Error("Invalid scan operation.");
      const response = await fetch(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw azureFailure(response.status);
      const result = await response.json();
      let update: Record<string, unknown> | null = null;
      if (result.status === "succeeded") {
        const extracted = extractReceipt(result.analyzeResult ?? {});
        update = { details: extracted.details, warnings: extracted.warnings, scan_status: "SUCCEEDED", status: "DRAFT", operation_url: null, updated_at: new Date().toISOString() };
      } else if (result.status === "failed" || new Date(row.scan_started_at).getTime() < Date.now() - 3600000) {
        update = { scan_status: "FAILED", operation_url: null };
      }
      if (update) {
        const { data: updated, error: updateError } = await db.from("purchase_receipts").update(update).eq("id", id).eq("operation_url", row.operation_url).select(receiptSelection).maybeSingle();
        if (updateError) throw new Error("Unable to store scan results. Try refreshing.");
        if (updated) return Response.json({ receipt: updated }, { headers: { "Cache-Control": "no-store" } });
      }
    } else if (row.scan_status === "RUNNING" && new Date(row.scan_started_at).getTime() < Date.now() - 60000) {
      const { error: resetError } = await db.from("purchase_receipts").update({ scan_status: "FAILED" }).eq("id", id).is("operation_url", null);
      if (!resetError) row.scan_status = "FAILED";
    }
    const receipt = Object.fromEntries(receiptSelection.split(",").map(field => [field, row[field]]));
    return Response.json({ receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return receiptError(error); }
}

export async function POST(request: Request, context: Context) {
  let failScan: (() => Promise<void>) | undefined;
  try {
    const { db, user, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const { endpoint, key } = azureConfig();
    const { data: row, error } = await receiptScope(db.from("purchase_receipts").select("file_path,model"), locationId).eq("id", id).is("deleted_at", null).single();
    if (error || !row) throw new Error("Receipt not found.");
    const { data: allowed, error: quotaError } = await db.rpc("reserve_receipt_scan", { p_receipt_id: id, p_user_id: user.id });
    if (quotaError) throw new Error("Scan limits are not configured. Apply the receipt migration.");
    if (!allowed) return Response.json({ error: "Scan limit reached or another scan is running. Limits: 10 per user per day and 100 per environment per month. Wait before retrying; manual entry remains available." }, { status: 429 });
    failScan = async () => { await db.from("purchase_receipts").update({ scan_status: "FAILED", operation_url: null }).eq("id", id); };
    const { data: file, error: downloadError } = await db.storage.from("purchase-receipts").download(row.file_path);
    if (downloadError || !file) throw new Error("Unable to read original receipt.");
    const response = await fetch(`${endpoint}/documentintelligence/documentModels/${row.model}:analyze?api-version=2024-11-30&pages=1-2`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/octet-stream" }, body: await file.arrayBuffer(), redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw azureFailure(response.status);
    const location = response.headers.get("operation-location");
    if (!location || new URL(location).origin !== endpoint) throw new Error("Azure did not return a valid scan operation.");
    const { error: updateError } = await db.from("purchase_receipts").update({ operation_url: location }).eq("id", id);
    if (updateError) throw new Error("Unable to track scan. This attempt has counted toward the limit.");
    return Response.json({ started: true }, { status: 202 });
  } catch (error) { await failScan?.(); return receiptError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { db, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const body = await request.json();
    if (!validReceiptDetails(body.details) || !expenseCategories.includes(body.category)) throw new Error("Check the receipt details and category.");
    const missing = receiptWarnings(body.details).filter(w => w.startsWith("Enter"));
    if (missing.length) throw new Error(missing.join(" "));
    if (body.reviewed !== true) throw new Error("Confirm that you reviewed the original receipt.");
    const { data, error } = await receiptScope(db.from("purchase_receipts").update({ details: body.details, category: body.category, status: "SAVED", updated_at: new Date().toISOString() }), locationId).eq("id", id).is("deleted_at", null).neq("scan_status", "RUNNING").select(receiptSelection).single();
    if (error || !data) throw new Error("Unable to save. Wait for any running scan, then retry.");
    return Response.json({ receipt: data });
  } catch (error) { return receiptError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { db, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const now = new Date().toISOString();
    const { data, error } = await receiptScope(db.from("purchase_receipts").update({ deleted_at: now, updated_at: now }), locationId)
      .eq("id", id).is("deleted_at", null).neq("scan_status", "RUNNING")
      .select("id").single();
    if (error || !data) throw new Error("Unable to delete invoice. Wait for any running scan, then retry.");
    return Response.json({ deleted: true });
  } catch (error) { return receiptError(error); }
}
