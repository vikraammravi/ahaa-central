import {expect,it,vi} from "vitest";
import {GET} from "@/server/business/billing/pdf-handler";
import {db,queryResult} from "@tests/mocks/supabase";
import {pdfId,pdfProfile,pdfOrder} from "@tests/mocks/invoice-pdf";
import {createSupabaseServer} from "@/lib/supabase/server";
import {renderToBuffer} from "@react-pdf/renderer";
vi.mock("@/lib/supabase/server",()=>({createSupabaseServer:vi.fn(async()=>db)}));
vi.mock("@react-pdf/renderer",()=>({renderToBuffer:vi.fn(async()=>Buffer.from("%PDF-1.7 test"))}));
vi.mock("@/server/business/billing/InvoicePdfDocument",()=>({InvoicePdfDocument:vi.fn(()=>null)}));
function request(kind="individual",id=pdfId,cookie?:string){return GET(new Request(`http://localhost/api/invoices/${kind}/${id}/pdf`,{headers:cookie?{cookie}:{}}),{params:Promise.resolve({kind,id})});}
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
it.each(["ahaa_business=not-a-uuid","ahaa_business=%E0%A4%A","ahaa_business=11111111-1111-4111-8111-111111111111; ahaa_business=22222222-2222-4222-8222-222222222222"])("rejects malformed workspace cookies before loading invoice data: %s",async cookie=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
  const response=await request("individual",pdfId,cookie);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({error:"Invalid workspace selection."});
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(createSupabaseServer).not.toHaveBeenCalled();
  expect(db.from).not.toHaveBeenCalled();
  expect(renderToBuffer).not.toHaveBeenCalled();
});
it("keeps unexpected client initialization errors private",async()=>{
  vi.stubEnv("NEXT_PUBLIC_BUSINESS_WORKSPACES_ENABLED","true");
  vi.mocked(createSupabaseServer).mockRejectedValueOnce(new Error("Internal credential configuration failure"));
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try{
    const response=await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:"Unable to generate this invoice PDF. Please try again."});
    expect(renderToBuffer).not.toHaveBeenCalled();
  }finally{log.mockRestore();}
});
