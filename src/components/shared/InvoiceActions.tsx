import Link from "next/link";
import {FileText,Pencil} from "lucide-react";
import {Button} from "@/components/ui/button";
import {invoicePdfUrl,type InvoicePdfKind} from "@/lib/invoice-pdf";
export function InvoiceActions({id,kind,edit=false}:{id:string;kind:InvoicePdfKind;edit?:boolean}){
  return <div className="inline-flex items-center gap-1" onClick={event=>event.stopPropagation()}>
    {edit&&<Button asChild variant="outline" size="icon" className="size-11 lg:size-9" title="Edit invoice" aria-label="Edit invoice"><Link href={`/admin/invoices/${id}`}><Pencil className="size-4"/></Link></Button>}
    <Button asChild variant="outline" size="icon" className="size-11 lg:size-9" title="View PDF" aria-label="View PDF"><a href={invoicePdfUrl(kind,id)} target="_blank" rel="noopener noreferrer"><FileText className="size-4"/></a></Button>
  </div>;
}
