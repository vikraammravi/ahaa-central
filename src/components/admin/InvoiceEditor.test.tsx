import { invoiceLine as line } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceEditor } from "@/components/admin/InvoiceEditor";

import { order } from "@tests/mocks/fixtures";
import { db } from "@tests/mocks/supabase";

it("invoice editor allows quantities and tax while locking prices",async()=>{
  const saved=vi.fn();render(<InvoiceEditor order={order} lines={[line]} onSaved={saved} onCancel={vi.fn()}/>);
  expect(screen.getByRole("button",{name:"Save Invoice Changes"})).toBeDisabled();expect(screen.getAllByRole("spinbutton")).toHaveLength(1);expect(screen.getByRole("option",{name:"N/A"})).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Billed Quantity"));await userEvent.type(screen.getByLabelText("Billed Quantity"),"7");await userEvent.selectOptions(screen.getByLabelText("Tax"),"true");expect(screen.getByText("Updated total: CA$79.10")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Save Invoice Changes"}));expect(db.rpc).toHaveBeenCalledWith("edit_invoice",expect.objectContaining({p_lines:[expect.objectContaining({quantity:7,unit_price:10,is_taxable:true})],p_expected_updated_at:order.updated_at}));expect(saved).toHaveBeenCalled();
});
