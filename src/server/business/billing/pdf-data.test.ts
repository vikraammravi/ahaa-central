import {expect,it,vi} from "vitest";
import {loadInvoicePdf} from "@/server/business/billing/pdf-data";
import {db,queryResult} from "@tests/mocks/supabase";
import {pdfId,pdfProfile,pdfOrder,pdfCombinedRecord,pdfSnapshot} from "@tests/mocks/invoice-pdf";
import {adminWorkspace,otherBusinessId} from "@tests/mocks/workspaces";
type Database=Parameters<typeof loadInvoicePdf>[0];
function setup(profile=pdfProfile,record=pdfCombinedRecord){
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:table==="orders"?pdfOrder:record));
  db.rpc.mockReturnValue(queryResult(pdfSnapshot));
}
it("requires sign-in and disallows employees",async()=>{
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:401});
  setup({...pdfProfile,role:"BRANCH_EMPLOYEE"});
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:403});
});
it("admin individual PDFs use billed quantity and tax corrections",async()=>{
  setup();db.from.mockImplementation(table=>queryResult(table==="profiles"?pdfProfile:{...pdfOrder,order_lines:[{...pdfOrder.order_lines[0],invoice_quantity:2,invoice_is_taxable:true,invoice_line_total:20}]}));
  const invoice=await loadInvoicePdf(db as unknown as Database,"individual",pdfId);
  expect(invoice.lines[0]).toMatchObject({quantity:2,taxable:true,subtotal:20});expect(invoice.draft).toBe(true);
});
it("branch managers receive the published snapshot and cannot access individual, foreign or unsent invoices",async()=>{
  setup({...pdfProfile,role:"BRANCH_MANAGER"});
  const invoice=await loadInvoicePdf(db as unknown as Database,"combined",pdfId);
  expect(invoice.total).toBe(pdfSnapshot.total);expect(db.rpc).toHaveBeenCalledWith("weekly_invoice_details",{p_invoice_id:pdfId,p_live:false});
  await expect(loadInvoicePdf(db as unknown as Database,"individual",pdfId)).rejects.toMatchObject({status:403});
  setup({...pdfProfile,role:"BRANCH_MANAGER",location_id:"other"});
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:404});
  setup({...pdfProfile,role:"BRANCH_MANAGER"},{...pdfCombinedRecord,sent_at:null as unknown as string});
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:404});
});
it("only admin sees unsent revisions and paid totals needing review stay flagged",async()=>{
  setup(pdfProfile,{...pdfCombinedRecord,revision:1,payment_status:"PAID",payment_revision:0});
  db.rpc.mockReturnValue(queryResult({...pdfSnapshot,revision:1}));
  const invoice=await loadInvoicePdf(db as unknown as Database,"combined",pdfId);
  expect(invoice.draft).toBe(true);expect(invoice.paymentNeedsReview).toBe(true);expect(db.rpc).toHaveBeenCalledWith("weekly_invoice_details",{p_invoice_id:pdfId,p_live:true});
});
it("maps edited unsent combined invoice lines, order amounts and totals to the admin PDF",async()=>{
  setup(pdfProfile,{...pdfCombinedRecord,sent_at:null as unknown as string,sent_revision:null as unknown as number,revision:1});
  db.rpc.mockReturnValue(queryResult({
    ...pdfSnapshot,sent_at:null,revision:1,
    lines:[{...pdfSnapshot.lines[0],quantity:8,is_taxable:true,subtotal:80,tax:10.4}],
    orders:[{...pdfSnapshot.orders[0],total:90.4}],subtotal:80,tax:10.4,total:90.4,
  }));
  const invoice=await loadInvoicePdf(db as unknown as Database,"combined",pdfId);
  expect(invoice.draft).toBe(true);
  expect(invoice.lines).toEqual([{name:pdfSnapshot.lines[0].name,unit:"Bucket",quantity:8,price:10,taxable:true,subtotal:80}]);
  expect(invoice.orders).toEqual([{number:pdfSnapshot.orders[0].order_number,date:pdfSnapshot.orders[0].order_date,total:90.4}]);
  expect(invoice).toMatchObject({subtotal:80,tax:10.4,total:90.4});
  expect(db.rpc).toHaveBeenCalledWith("weekly_invoice_details",{p_invoice_id:pdfId,p_live:true});
});
it("keeps a branch PDF on its published snapshot when a different live revision exists",async()=>{
  setup({...pdfProfile,role:"BRANCH_MANAGER"},{...pdfCombinedRecord,revision:1});
  db.rpc.mockImplementation((_name,args)=>queryResult(args.p_live
    ? {...pdfSnapshot,revision:1,subtotal:80,tax:10.4,total:90.4,orders:[{...pdfSnapshot.orders[0],total:90.4}]}
    : pdfSnapshot));
  const invoice=await loadInvoicePdf(db as unknown as Database,"combined",pdfId);
  expect(db.rpc).toHaveBeenCalledWith("weekly_invoice_details",{p_invoice_id:pdfId,p_live:false});
  expect(invoice.draft).toBe(false);
  expect(invoice.lines[0]).toMatchObject({quantity:5,taxable:false,subtotal:50});
  expect(invoice.orders).toEqual([{number:pdfSnapshot.orders[0].order_number,date:pdfSnapshot.orders[0].order_date,total:50}]);
  expect(invoice).toMatchObject({subtotal:50,tax:0,total:50});
});
it("denies a foreign business invoice when the authorized workspace query returns no row",async()=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
  db.auth.getUser.mockResolvedValue({data:{user:{id:adminWorkspace.profile.id}},error:null});
  db.rpc.mockImplementation(name=>queryResult(name==="current_workspace"?adminWorkspace:pdfSnapshot));
  db.from.mockReturnValue(queryResult(null));
  await expect(loadInvoicePdf(db as unknown as Database,"individual",otherBusinessId)).rejects.toMatchObject({status:404});
  await expect(loadInvoicePdf(db as unknown as Database,"combined",otherBusinessId)).rejects.toMatchObject({status:404});
  expect(db.rpc).not.toHaveBeenCalledWith("weekly_invoice_details",expect.anything());
  expect(db.from).not.toHaveBeenCalledWith("profiles");
});
it("denies invoice access when the selected workspace is unavailable",async()=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
  db.auth.getUser.mockResolvedValue({data:{user:{id:adminWorkspace.profile.id}},error:null});
  db.rpc.mockReturnValue(queryResult(null,{message:"Workspace access is unavailable"}));
  await expect(loadInvoicePdf(db as unknown as Database,"individual",pdfId)).rejects.toMatchObject({status:403});
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:403});
  expect(db.from).not.toHaveBeenCalled();
  expect(db.rpc).not.toHaveBeenCalledWith("weekly_invoice_details",expect.anything());
});
it("uses the selected business role when a user cannot access invoices there",async()=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
  db.auth.getUser.mockResolvedValue({data:{user:{id:adminWorkspace.profile.id}},error:null});
  db.rpc.mockReturnValue(queryResult({...adminWorkspace,profile:{...adminWorkspace.profile,role:"BRANCH_EMPLOYEE",location_id:"44444444-4444-4444-8444-444444444444"}}));
  await expect(loadInvoicePdf(db as unknown as Database,"combined",pdfId)).rejects.toMatchObject({status:403});
  expect(db.from).not.toHaveBeenCalled();
});
