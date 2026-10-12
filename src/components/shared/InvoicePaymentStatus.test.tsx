import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoicePaymentStatus } from "@/components/shared/InvoicePaymentStatus";
import userEvent from "@testing-library/user-event";
import { db } from "@tests/mocks/supabase";

it("payment controls are read-only for branches",()=>{
  render(<InvoicePaymentStatus invoiceId="invoice" payment={{payment_status:"UNPAID",payment_updated_at:null,payment_updated_name:null,payment_updated_by:null,payment_revision:null}} revision={1} isAdmin={false} onUpdated={vi.fn()}/>);
  expect(screen.getByText("Unpaid")).toBeVisible();expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("admin payment update includes conflict protection",async()=>{
  const updated=vi.fn();render(<InvoicePaymentStatus invoiceId="invoice" payment={{payment_status:"UNPAID",payment_updated_at:null,payment_updated_name:null,payment_updated_by:null,payment_revision:null}} revision={1} isAdmin onUpdated={updated}/>);
  await userEvent.click(screen.getByRole("button",{name:"Mark Paid"}));expect(db.rpc).toHaveBeenCalledWith("set_invoice_payment_status",{p_invoice_id:"invoice",p_status:"PAID",p_expected_updated_at:null});expect(updated).toHaveBeenCalled();
});

it("paid invoice corrections require payment review",()=>{
  render(<InvoicePaymentStatus invoiceId="invoice" payment={{payment_status:"PAID",payment_updated_at:null,payment_updated_name:null,payment_updated_by:null,payment_revision:1}} revision={2} isAdmin onUpdated={vi.fn()}/>);expect(screen.getByRole("button",{name:"Confirm Paid"})).toBeVisible();
});
