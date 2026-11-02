import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, taxLabel } from "@/lib/format";

export function InvoiceTotals({ subtotal, tax, total }: { subtotal: number; tax: number; total: number }) {
  return <Card className="sm:max-w-sm sm:ml-auto"><CardContent className="p-5 space-y-3 text-sm">
    <div className="flex justify-between gap-4"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
    <div className="flex justify-between gap-4"><span>Tax ({taxLabel(Number(tax) > 0)})</span><span>{formatMoney(tax)}</span></div>
    <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold"><span>Total</span><span>{formatMoney(total)}</span></div>
  </CardContent></Card>;
}
