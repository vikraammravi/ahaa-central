import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminInvoices from "@/app/admin/invoices/page";
import { branch, order } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("select all and combine creates one invoice for completed uncombined orders",async()=>{
  const ordersQuery=queryResult([{...order,locations:branch,pickup_requests:[]}],null,1);db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):ordersQuery);db.rpc.mockReturnValue(queryResult("invoice"));render(<AdminInvoices/>);await screen.findByText("INV-12");expect(ordersQuery.eq).toHaveBeenCalledWith("status","COMPLETED");expect(ordersQuery.not).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("From Date"),"2026-10-01");await userEvent.type(screen.getByLabelText("To Date"),"2026-10-12");await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);await userEvent.click(screen.getByRole("button",{name:"Select All Eligible Invoices"}));await waitFor(()=>expect(screen.getByRole("checkbox",{name:"Select order 12"})).toBeChecked());await userEvent.click(screen.getByRole("button",{name:"Combine Invoices (1 selected)"}));expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice",expect.objectContaining({p_order_ids:[order.id],p_location_id:branch.id}));
});
