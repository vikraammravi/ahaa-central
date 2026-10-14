import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchInvoices from "@/app/branch/invoices/page";
import { order } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("branch orders keep pickup decision in its own column",async()=>{
  db.from.mockReturnValue(queryResult([{...order,weekly_invoices:null,pickup_requests:[{status:"REJECTED",requested_at:"2026-10-12"}]}],null,1));render(<BranchInvoices/>);expect(await screen.findByText("Rejected")).toBeVisible();expect(screen.getByRole("columnheader",{name:"Pickup Approval"})).toBeVisible();
});

it("filters orders by number and status on the server",async()=>{
  const query=queryResult([order],null,1);
  db.from.mockReturnValue(query);
  render(<BranchInvoices/>);
  await screen.findByText(`#${order.order_number}`);
  const user=userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Status"),"READY");
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("status","READY"));
  await user.type(screen.getByLabelText("Search Order Number"),"#15");
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("order_number",15));
  expect(query.range).toHaveBeenLastCalledWith(0,24);
  await user.clear(screen.getByLabelText("Search Order Number"));
  await user.type(screen.getByLabelText("Search Order Number"),"invalid");
  expect(await screen.findByText("No matching orders")).toBeVisible();
});
