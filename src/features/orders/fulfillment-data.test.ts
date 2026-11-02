import { expect, it } from "vitest";
import { db, queryResult } from "@tests/mocks/supabase";
import { saveOrderFulfillment } from "@/features/orders/fulfillment-data";
import { invoiceLine } from "@tests/mocks/fixtures";
it("sends changed lines in one atomic call with expected values", async () => {
 db.rpc.mockReturnValue(queryResult(null));
 await saveOrderFulfillment("order", [invoiceLine], { [invoiceLine.id]: { fulfilled: 3, reason: " shortage " } });
 expect(db.rpc).toHaveBeenCalledTimes(1);
 expect(db.rpc).toHaveBeenCalledWith("save_order_fulfillment", { p_order_id: "order", p_lines: [{ line_id: invoiceLine.id, quantity: 3, note: "shortage", expected_quantity: invoiceLine.fulfilled_quantity, expected_note: invoiceLine.shortage_reason ?? "" }] });
 expect(db.from).not.toHaveBeenCalled();
});
it("does not mutate for unchanged or invalid quantities", async () => {
 await saveOrderFulfillment("order", [invoiceLine], { [invoiceLine.id]: { fulfilled: invoiceLine.fulfilled_quantity, reason: invoiceLine.shortage_reason ?? "" } });
 expect(db.rpc).not.toHaveBeenCalled();
 await expect(saveOrderFulfillment("order", [invoiceLine], { [invoiceLine.id]: { fulfilled: invoiceLine.quantity+1, reason: "" } })).rejects.toThrow("whole fulfillment");
 expect(db.rpc).not.toHaveBeenCalled();
});
it("surfaces stale-edit errors instead of retrying with stale values", async () => {
 db.rpc.mockReturnValue(queryResult(null, { message: "Changed by another user" }));
 await expect(saveOrderFulfillment("order", [invoiceLine], { [invoiceLine.id]: { fulfilled: 2, reason: "" } })).rejects.toThrow("Changed by another user");
 expect(db.rpc).toHaveBeenCalledTimes(1);
});
