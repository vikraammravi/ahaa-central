import {expect,it} from "vitest";
import {loadInvoicePdf} from "./invoice-pdf-data";
import {db,queryResult} from "@tests/mocks/supabase";
import {pdfId,pdfProfile,pdfOrder,pdfCombinedRecord,pdfSnapshot} from "@tests/mocks/invoice-pdf";
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
