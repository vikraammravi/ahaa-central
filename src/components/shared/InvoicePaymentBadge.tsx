import { StatusBadge } from "@/components/ui/status-badge";
import { paymentNeedsReview,type InvoicePaymentRecord } from "@/lib/payments";
export function InvoicePaymentBadge({payment,revision}:{payment:InvoicePaymentRecord;revision:number}){return <div className="space-y-1"><StatusBadge status={payment.payment_status==="PAID"?"paid":"pending"} label={payment.payment_status==="PAID"?"Paid":"Unpaid"}/>{paymentNeedsReview(payment,revision)&&<p className="text-xs text-saffron-hover">Payment review needed</p>}</div>;}
