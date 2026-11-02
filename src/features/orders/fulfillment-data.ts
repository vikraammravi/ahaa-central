import { supabase } from "@/lib/supabase/client";
export type FulfillmentLine = { id: string; quantity: number; fulfilled_quantity: number; shortage_reason: string | null };
export type FulfillmentEdit = { fulfilled: number; reason: string };
export async function saveOrderFulfillment(orderId: string, lines: FulfillmentLine[], edits: Record<string, FulfillmentEdit>): Promise<void> {
 const changes = lines.flatMap(line => {
  const edit = edits[line.id];
  if (!edit || (edit.fulfilled === line.fulfilled_quantity && edit.reason === (line.shortage_reason ?? ""))) return [];
  if (!Number.isInteger(edit.fulfilled) || edit.fulfilled < 0 || edit.fulfilled > line.quantity) throw new Error("Use whole fulfillment quantities between zero and the ordered quantity.");
  return [{ line_id: line.id, quantity: edit.fulfilled, note: edit.reason.trim(), expected_quantity: line.fulfilled_quantity, expected_note: line.shortage_reason ?? "" }];
 });
 if (!changes.length) return;
 const { error } = await supabase.rpc("save_order_fulfillment", { p_order_id: orderId, p_lines: changes });
 if (error) throw new Error(error.message);
}
