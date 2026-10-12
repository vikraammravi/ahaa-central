import { invoiceLine as line } from "@tests/mocks/fixtures";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceHistory } from "@/components/admin/InvoiceHistory";

import type { InvoiceEdit } from "@/lib/supabase/types";

it("invoice audit shows quantity and tax changes",()=>{
  const edit={id:"edit",revision:1,edited_at:"2026-10-12T12:00:00Z",edited_profile:{full_name:"Admin"},reason:"Correction",previous_lines:[line],updated_lines:[{...line,fulfilled_quantity:7,is_taxable:true}],stock_adjustments:[]} as unknown as InvoiceEdit;
  render(<InvoiceHistory history={[edit]}/>);expect(screen.getByText(/Quantity: 5 → 7/)).toHaveTextContent("Tax: N/A → 13%");
});
