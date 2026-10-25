import {renderToBuffer} from "@react-pdf/renderer";
import {createSupabaseServer} from "@/lib/supabase/server";
import {InvoicePdfError,loadInvoicePdf} from "@/lib/invoice-pdf-data";
import {InvoicePdfDocument} from "@/components/invoices/InvoicePdfDocument";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  const {kind,id}=await params;
  if(!["individual","combined"].includes(kind)||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id))return Response.json({error:"Invalid invoice."},{status:400});
  try{
    const invoice=await loadInvoicePdf(await createSupabaseServer(),kind as "individual"|"combined",id);
    const pdf=await renderToBuffer(InvoicePdfDocument({invoice}));
    return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${invoice.number}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    if(error instanceof InvoicePdfError)return Response.json({error:error.message},{status:error.status,headers:{"Cache-Control":"private, no-store"}});
    console.error("Invoice PDF generation failed",error instanceof Error?error.message:"Unknown error");
    return Response.json({error:"Unable to generate this invoice PDF. Please try again."},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}
