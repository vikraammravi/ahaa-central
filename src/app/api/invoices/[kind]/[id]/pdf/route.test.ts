import {expect,it,vi} from "vitest";
import {GET} from "./route";
import {db,queryResult} from "@tests/mocks/supabase";
import {pdfId,pdfProfile,pdfOrder} from "@tests/mocks/invoice-pdf";
vi.mock("@/lib/supabase/server",()=>({createSupabaseServer:vi.fn(async()=>db)}));
vi.mock("@react-pdf/renderer",()=>({renderToBuffer:vi.fn(async()=>Buffer.from("%PDF-1.7 test"))}));
vi.mock("@/components/invoices/InvoicePdfDocument",()=>({InvoicePdfDocument:vi.fn(()=>null)}));
function request(kind="individual",id=pdfId){return GET(new Request(`http://localhost/api/invoices/${kind}/${id}/pdf`),{params:Promise.resolve({kind,id})});}
it("returns an inline PDF with private no-store headers",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:pdfProfile.id}},error:null});
  db.from.mockImplementation(table=>queryResult(table==="profiles"?pdfProfile:pdfOrder));
  const response=await request();
  expect(response.status).toBe(200);expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"INV-12.pdf\"");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");expect(await response.text()).toMatch(/^%PDF/);
});
it("rejects invalid identifiers and unauthenticated access",async()=>{
  expect((await request("individual","invalid")).status).toBe(400);
  expect((await request("unknown")).status).toBe(400);
  expect((await request()).status).toBe(401);
});
