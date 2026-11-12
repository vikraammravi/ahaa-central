import { expect,it } from "vitest";
import { createCombinedInvoice, fetchCombinedInvoicePreview } from "@/features/billing/data";
import { db,queryResult } from "@tests/mocks/supabase";
import { branch,order } from "@tests/mocks/fixtures";
import { combineCandidates, combineFilters, combinePreview, manyCombineCandidates } from "@tests/mocks/combine-invoice-preview";

it("previews all selected invoices beyond one display page, ordered by date with accurate totals",async()=>{
  const query=queryResult([...combineCandidates].reverse());db.from.mockReturnValue(query);
  expect(await fetchCombinedInvoicePreview(combineFilters,combineCandidates.map(row=>row.id))).toEqual(combinePreview);
  expect(query.in).toHaveBeenCalledWith("id",["earlier","later"]);
  expect(query.eq).toHaveBeenCalledWith("location_id",branch.id);
  expect(db.rpc).not.toHaveBeenCalled();
});

it("batches large cross-page selections and includes every selected invoice in totals",async()=>{
  db.from.mockReturnValueOnce(queryResult(manyCombineCandidates.slice(0,100))).mockReturnValueOnce(queryResult(manyCombineCandidates.slice(100)));
  const preview=await fetchCombinedInvoicePreview(combineFilters,manyCombineCandidates.map(row=>row.id));
  expect(db.from).toHaveBeenCalledTimes(2);
  expect(preview.orders).toHaveLength(101);
  expect(preview).toMatchObject({subtotal:1010,tax:131.3,total:1141.3});
});

it.each([
  {...combineCandidates[0],status:"READY"},
  {...combineCandidates[0],weekly_invoice_id:"combined"},
  {...combineCandidates[0],pickup_approval_status:"PENDING"},
  {...combineCandidates[0],pickup_requests:[{return_status:"PENDING"}]},
])("rejects ineligible selected invoices before previewing or combining ($status)",async candidate=>{
  db.from.mockReturnValue(queryResult([candidate]));
  await expect(fetchCombinedInvoicePreview(combineFilters,[candidate.id])).rejects.toThrow("no longer completed, settled and uncombined");
  expect(db.rpc).not.toHaveBeenCalled();
});

it("rejects missing, foreign and duplicate IDs rather than returning a partial preview",async()=>{
  db.from.mockReturnValue(queryResult([]));
  await expect(fetchCombinedInvoicePreview(combineFilters,["missing"])).rejects.toThrow("unavailable or belong to another branch");
  db.from.mockReturnValue(queryResult([combineCandidates[1]]));
  await expect(fetchCombinedInvoicePreview(combineFilters,["earlier"])).rejects.toThrow("unavailable");
  await expect(fetchCombinedInvoicePreview(combineFilters,["earlier","earlier"])).rejects.toThrow("Choose a branch");
  expect(db.rpc).not.toHaveBeenCalled();
});

it.each([null,-1,Number.NaN])("rejects invalid preview amounts (%s)",async amount=>{
  db.from.mockReturnValue(queryResult([{...combineCandidates[0],final_total_amount:amount}]));
  await expect(fetchCombinedInvoicePreview(combineFilters,["earlier"])).rejects.toThrow("invalid amounts");
});

it("combines a branch's selected invoices without dates and derives the full selected period",async()=>{
  db.from.mockReturnValue(queryResult([{...order,id:"later",order_date:"2026-10-24"},{...order,id:"earlier",order_date:"2026-10-01"}]));
  db.rpc.mockReturnValue(queryResult("combined"));
  expect(await createCombinedInvoice({branchId:branch.id,startDate:"",endDate:""},["later","earlier"],combinePreview)).toBe("combined");
  expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice_checked",{p_location_id:branch.id,p_start_date:"2026-10-01",p_end_date:"2026-10-24",p_order_ids:["later","earlier"],p_expected:combinePreview.orders});
});

it("rejects unavailable, cross-branch or out-of-filter selections before combining",async()=>{
  db.from.mockReturnValue(queryResult([]));
  await expect(createCombinedInvoice({branchId:branch.id,startDate:"",endDate:""},[order.id],combinePreview)).rejects.toThrow("unavailable");
  db.from.mockReturnValue(queryResult([order]));
  await expect(createCombinedInvoice({branchId:branch.id,startDate:"2026-10-20",endDate:""},[order.id],combinePreview)).rejects.toThrow("outside your date filters");
  expect(db.rpc).not.toHaveBeenCalled();
});
