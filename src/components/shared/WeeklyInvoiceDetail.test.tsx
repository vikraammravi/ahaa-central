import { combinedInvoice as details } from "@tests/mocks/fixtures";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyInvoiceDetail } from "@/components/shared/WeeklyInvoiceDetail";
import { item } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("combined invoice details use one header with no legacy history sections",async()=>{
  db.rpc.mockReturnValue(queryResult(details));db.from.mockReturnValue(queryResult({revision:0,sent_revision:null,sent_at:null,payment_status:"UNPAID",payment_revision:null,payment_updated_at:null}));render(<WeeklyInvoiceDetail invoiceId="invoice" isAdmin/>);await screen.findByText(item.name);expect(screen.getByText("From Date")).toBeVisible();expect(screen.getByText("Oct 1, 2026")).toBeVisible();expect(screen.queryByText("Sent Versions")).not.toBeInTheDocument();expect(screen.queryByText(/Included Orders/)).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Send Invoice"}));expect(db.rpc).toHaveBeenCalledWith("send_weekly_invoice",{p_invoice_id:"invoice"});
});
