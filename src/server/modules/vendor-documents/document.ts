import "server-only";
import { businessWorkspacesEnabled } from "@/features/workspaces/context";
import { azureConfig, readDocumentScan, startDocumentScan } from "@/server/infrastructure/azure-document-intelligence";
import { receiptAccess, receiptError, receiptSelection, receiptScope } from "@/server/modules/vendor-documents/access";
import { expenseCategories, extractReceipt, receiptWarnings, validReceiptDetails } from "@/features/vendor-documents/domain";
type Context = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(request: Request, context: Context) {
  try {
    const { db, businessId, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const { data: row, error } = await receiptScope(db.from("purchase_receipts").select("*"), locationId, businessId).eq("id", id).is("deleted_at", null).single();
    if (error || !row) throw new Error("Receipt not found.");
    if (new URL(request.url).searchParams.get("original") === "1") {
      const { data, error: fileError } = await db.storage.from("purchase-receipts").createSignedUrl(row.file_path, 120);
      if (fileError || !data) throw new Error("Unable to open original receipt.");
      return new Response(null, { status: 307, headers: { Location: data.signedUrl, "Cache-Control": "no-store" } });
    }
    if (row.scan_status === "RUNNING" && row.operation_url) {
      const result = await readDocumentScan(row.operation_url);
      let update: Record<string, unknown> | null = null;
      if (result.status === "succeeded") {
        const extracted = extractReceipt(result.analyzeResult ?? {});
        update = { details: extracted.details, warnings: extracted.warnings, scan_status: "SUCCEEDED", status: "DRAFT", operation_url: null, updated_at: new Date().toISOString() };
      } else if (result.status === "failed" || new Date(row.scan_started_at).getTime() < Date.now() - 3600000) {
        update = { scan_status: "FAILED", operation_url: null };
      }
      if (update) {
        const { data: updated, error: updateError } = await receiptScope(db.from("purchase_receipts").update(update), locationId, businessId).eq("id", id).eq("operation_url", row.operation_url).select(receiptSelection).maybeSingle();
        if (updateError) throw new Error("Unable to store scan results. Try refreshing.");
        if (updated) return Response.json({ receipt: updated }, { headers: { "Cache-Control": "no-store" } });
      }
    } else if (row.scan_status === "RUNNING" && new Date(row.scan_started_at).getTime() < Date.now() - 60000) {
      const { error: resetError } = await receiptScope(db.from("purchase_receipts").update({ scan_status: "FAILED" }), locationId, businessId).eq("id", id).is("operation_url", null);
      if (!resetError) row.scan_status = "FAILED";
    }
    const receipt = Object.fromEntries(receiptSelection.split(",").map(field => [field, row[field]]));
    return Response.json({ receipt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return receiptError(error); }
}

export async function POST(request: Request, context: Context) {
  let failScan: (() => Promise<void>) | undefined;
  try {
    const { db, user, businessId, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const { endpoint, key } = azureConfig();
    const { data: row, error } = await receiptScope(db.from("purchase_receipts").select("file_path,model"), locationId, businessId).eq("id", id).is("deleted_at", null).single();
    if (error || !row) throw new Error("Receipt not found.");
    const { data: allowed, error: quotaError } = await db.rpc(businessWorkspacesEnabled() ? "reserve_receipt_scan_for_business" : "reserve_receipt_scan", { ...(businessWorkspacesEnabled() ? { p_business_id: businessId } : {}), p_receipt_id: id, p_user_id: user.id });
    if (quotaError) throw new Error("Scan limits are not configured. Apply the receipt migration.");
    if (!allowed) return Response.json({ error: "Scan limit reached or another scan is running. Limits: 10 per user per day and 100 per environment per month. Wait before retrying; manual entry remains available." }, { status: 429 });
    failScan = async () => { await receiptScope(db.from("purchase_receipts").update({ scan_status: "FAILED", operation_url: null }), locationId, businessId).eq("id", id); };
    const { data: file, error: downloadError } = await db.storage.from("purchase-receipts").download(row.file_path);
    if (downloadError || !file) throw new Error("Unable to read original receipt.");
    const location = await startDocumentScan(endpoint, key, row.model, file);
    const { error: updateError } = await receiptScope(db.from("purchase_receipts").update({ operation_url: location }), locationId, businessId).eq("id", id);
    if (updateError) throw new Error("Unable to track scan. This attempt has counted toward the limit.");
    return Response.json({ started: true }, { status: 202 });
  } catch (error) { await failScan?.(); return receiptError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { db, businessId, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const body = await request.json();
    if (!validReceiptDetails(body.details) || !expenseCategories.includes(body.category)) throw new Error("Check the receipt details and category.");
    const missing = receiptWarnings(body.details).filter(w => w.startsWith("Enter"));
    if (missing.length) throw new Error(missing.join(" "));
    if (body.reviewed !== true) throw new Error("Confirm that you reviewed the original receipt.");
    const { data, error } = await receiptScope(db.from("purchase_receipts").update({ details: body.details, category: body.category, status: "SAVED", updated_at: new Date().toISOString() }), locationId, businessId).eq("id", id).is("deleted_at", null).neq("scan_status", "RUNNING").select(receiptSelection).single();
    if (error || !data) throw new Error("Unable to save. Wait for any running scan, then retry.");
    return Response.json({ receipt: data });
  } catch (error) { return receiptError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { db, businessId, locationId } = await receiptAccess(request);
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Invalid receipt.");
    const now = new Date().toISOString();
    const { data, error } = await receiptScope(db.from("purchase_receipts").update({ deleted_at: now, updated_at: now }), locationId, businessId)
      .eq("id", id).is("deleted_at", null).neq("scan_status", "RUNNING")
      .select("id").single();
    if (error || !data) throw new Error("Unable to delete invoice. Wait for any running scan, then retry.");
    return Response.json({ deleted: true });
  } catch (error) { return receiptError(error); }
}
