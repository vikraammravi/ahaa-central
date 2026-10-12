import { invoiceLine as line } from "@tests/mocks/fixtures";
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceDetail } from "@/components/shared/InvoiceDetail";
import { branch, order } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("individual invoice edit opens in a modal for completed orders",async()=>{
  db.from.mockImplementation(table=>queryResult(table==="orders"?{...order,locations:branch,pickup_requests:[]}:table==="order_lines"?[line]:[]));render(<InvoiceDetail orderId="order" isAdmin/>);await userEvent.click(await screen.findByRole("button",{name:"Edit Invoice"}));expect(screen.getByRole("dialog")).toBeVisible();expect(within(screen.getByRole("dialog")).getByLabelText("Billed Quantity")).toHaveValue(5);
});

it("pending pickup decisions disable invoice editing",async()=>{
  db.from.mockImplementation(table=>queryResult(table==="orders"?{...order,pickup_approval_status:"PENDING",locations:branch,pickup_requests:[]}:table==="order_lines"?[line]:[]));render(<InvoiceDetail orderId="order" isAdmin/>);await screen.findByText("Invoice INV-12");expect(screen.queryByRole("button",{name:"Edit Invoice"})).not.toBeInTheDocument();expect(screen.getByText(/Review the pending pickup/)).toBeVisible();
});
