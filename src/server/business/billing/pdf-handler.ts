import "server-only";
import {renderToBuffer} from "@react-pdf/renderer";
import {createSupabaseServer} from "@/lib/supabase/server";
import {InvoicePdfError,loadInvoicePdf} from "@/server/business/billing/pdf-data";
import {InvoicePdfDocument} from "@/server/business/billing/InvoicePdfDocument";
import {businessWorkspacesEnabled,selectedBusiness} from "@/features/workspaces/context";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  const {kind,id}=await params;
  if(!["individual","combined"].includes(kind)||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id))return Response.json({error:"Invalid invoice."},{status:400});
  if(businessWorkspacesEnabled()){
    // Validate only client-controlled selection here; internal failures stay private.
    try{selectedBusiness(request.headers.get("cookie")??"");}
    catch{return Response.json({error:"Invalid workspace selection."},{status:400,headers:{"Cache-Control":"private, no-store"}});}
  }
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
