import { expect,it } from "vitest";
import { createBranchOrder } from "./branch-order-data";
import { db,queryResult } from "@tests/mocks/supabase";
import { order,item } from "@tests/mocks/fixtures";

it("submits only item quantities through one atomic request and keeps the retry identifier",async()=>{
  db.rpc.mockReturnValue(queryResult(order.id));
  await createBranchOrder(order.id,{[item.id]:5});await createBranchOrder(order.id,{[item.id]:5});
  expect(db.rpc).toHaveBeenNthCalledWith(1,"create_branch_order",{p_order_id:order.id,p_quantities:[{item_id:item.id,quantity:5}]});
  expect(db.rpc.mock.calls[1]).toEqual(db.rpc.mock.calls[0]);expect(db.from).not.toHaveBeenCalled();
});
it("invalid quantities never start a submission and database errors are preserved",async()=>{
  await expect(createBranchOrder(order.id,{[item.id]:-1})).rejects.toThrow("positive whole units");
  expect(db.rpc).not.toHaveBeenCalled();
  db.rpc.mockReturnValue(queryResult(null,{message:"Central stock changed"}));
  await expect(createBranchOrder(order.id,{[item.id]:5})).rejects.toThrow("Central stock changed");
});
