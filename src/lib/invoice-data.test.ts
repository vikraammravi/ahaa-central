import { expect,it } from "vitest";
import { createCombinedInvoice } from "./invoice-data";
import { db,queryResult } from "@tests/mocks/supabase";
import { branch,order } from "@tests/mocks/fixtures";

it("combines a branch's selected invoices without dates and derives the full selected period",async()=>{
  db.from.mockReturnValue(queryResult([{...order,id:"later",order_date:"2026-10-24"},{...order,id:"earlier",order_date:"2026-10-01"}]));
  db.rpc.mockReturnValue(queryResult("combined"));
  expect(await createCombinedInvoice({branchId:branch.id,startDate:"",endDate:""},["later","earlier"])).toBe("combined");
  expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice",{p_location_id:branch.id,p_start_date:"2026-10-01",p_end_date:"2026-10-24",p_order_ids:["later","earlier"]});
});

it("rejects unavailable, cross-branch or out-of-filter selections before combining",async()=>{
  db.from.mockReturnValue(queryResult([]));
  await expect(createCombinedInvoice({branchId:branch.id,startDate:"",endDate:""},[order.id])).rejects.toThrow("unavailable");
  db.from.mockReturnValue(queryResult([order]));
  await expect(createCombinedInvoice({branchId:branch.id,startDate:"2026-10-20",endDate:""},[order.id])).rejects.toThrow("outside your date filters");
  expect(db.rpc).not.toHaveBeenCalled();
});
