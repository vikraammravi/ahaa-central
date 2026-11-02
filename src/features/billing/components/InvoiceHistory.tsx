import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatDateTime, taxLabel } from "@/lib/format";
import type { InvoiceEdit } from "@/lib/supabase/types";

export function InvoiceHistory({ history }: { history: InvoiceEdit[] }) {
  if (!history.length) return null;
  return <Card><CardHeader><CardTitle className="text-base">Invoice Change History</CardTitle></CardHeader><CardContent className="space-y-4">{history.map((edit) => <div key={edit.id} className="border-b last:border-0 pb-3 space-y-1 text-sm">
    <p className="font-medium">Revision {edit.revision} · {edit.edited_profile?.full_name ?? "Central admin"}</p><p className="text-xs text-muted-foreground">{formatDateTime(edit.edited_at)}</p><p>{edit.reason}</p>
    <details><summary className="cursor-pointer text-saffron-hover">View changes</summary><div className="mt-2 space-y-2">{edit.updated_lines.map((line) => {
      const before = edit.previous_lines.find((previous) => previous.id === line.id);
      if (!before || (before.fulfilled_quantity === line.fulfilled_quantity && Number(before.unit_price) === Number(line.unit_price) && before.is_taxable === line.is_taxable)) return null;
      const adjustment = edit.stock_adjustments.find((entry) => entry.line_id === line.id);
      return <div key={line.id}><p className="font-medium">{line.catalog_items?.name ?? "Item"}</p><p>Quantity: {before.fulfilled_quantity} → {line.fulfilled_quantity} · Price: {formatMoney(before.unit_price)} → {formatMoney(line.unit_price)} · Tax: {taxLabel(before.is_taxable)} → {taxLabel(line.is_taxable)}</p>{adjustment && adjustment.adjustment !== 0 && <p className="text-xs text-muted-foreground">Stock: {adjustment.adjustment > 0 ? "+" : ""}{adjustment.adjustment}</p>}{adjustment?.return_to_stock === false && <p className="text-xs text-muted-foreground">Reduced quantities marked wasted / unavailable.</p>}</div>;
    })}</div></details>
  </div>)}</CardContent></Card>;
}
