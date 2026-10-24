import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchInvoices from "@/app/branch/invoices/page";
import { order } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";
import { mockViewport } from "@tests/mocks/viewport";

it("tablet order cards keep approval status and permit editing only submitted orders",async()=>{
  mockViewport(820);
  db.from.mockReturnValue(queryResult([{...order,status:"SUBMITTED",weekly_invoices:null,pickup_requests:[{status:"APPROVED",requested_at:"2026-10-12"}]},{...order,id:"ready",order_number:99,status:"READY",weekly_invoices:null,pickup_requests:[]}],null,2));
  render(<BranchInvoices/>);
  expect(await screen.findByText(`Order #${order.order_number}`)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Approved")).toBeVisible();
  expect(screen.getAllByRole("link",{name:"View Order"})).toHaveLength(2);
  expect(screen.getAllByRole("link",{name:"Edit Order"})).toHaveLength(1);
  expect(screen.getByRole("link",{name:"Edit Order"})).toHaveAttribute("href",`/branch/order?edit=${order.id}`);
});

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
