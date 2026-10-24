import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminInvoices from "@/app/admin/invoices/page";
import { branch, order } from "@tests/mocks/fixtures";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { mockViewport } from "@tests/mocks/viewport";

it.each([390,820])("invoice cards separate selection from opening and combine from the bottom bar at %spx",async width=>{
  mockViewport(width);const query=queryResult([{...order,locations:branch,pickup_requests:[]}],null,1);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):query);db.rpc.mockReturnValue(queryResult("invoice"));
  render(<AdminInvoices/>);await screen.findByText("INV-12");
  expect(screen.getByRole("checkbox",{name:"Select order 12"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Search & filters"}));
  await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);
  await userEvent.click(screen.getByRole("button",{name:"Show results"}));
  const checkbox=screen.getByRole("checkbox",{name:"Select order 12"});await userEvent.click(checkbox);
  expect(checkbox).toBeChecked();expect(checkbox.closest('[data-slot="card"]')).toHaveClass("ring-2","ring-forest");
  expect(router.push).not.toHaveBeenCalled();expect(screen.getByRole("link",{name:"View Invoice"})).toHaveAttribute("href",`/admin/invoices/${order.id}`);
  expect(screen.getByRole("status")).toHaveTextContent("1 selected");
  await userEvent.click(screen.getByRole("button",{name:"Clear Selection"}));expect(checkbox).not.toBeChecked();
  await userEvent.click(screen.getByRole("button",{name:"Select All"}));await waitFor(()=>expect(checkbox).toBeChecked());
  await userEvent.click(screen.getByRole("button",{name:"Combine"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice",expect.objectContaining({p_order_ids:[order.id]})));
});

it("select all and combine creates one invoice for completed uncombined orders",async()=>{
  const ordersQuery=queryResult([{...order,locations:branch,pickup_requests:[]}],null,1);db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):ordersQuery);db.rpc.mockReturnValue(queryResult("invoice"));render(<AdminInvoices/>);await screen.findByText("INV-12");expect(ordersQuery.eq).toHaveBeenCalledWith("status","COMPLETED");expect(ordersQuery.not).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("From Date"),"2026-10-01");await userEvent.type(screen.getByLabelText("To Date"),"2026-10-12");await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);await userEvent.click(screen.getByRole("button",{name:"Select All Eligible Invoices"}));await waitFor(()=>expect(screen.getByRole("checkbox",{name:"Select order 12"})).toBeChecked());await userEvent.click(screen.getByRole("button",{name:"Combine Invoices (1 selected)"}));expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice",expect.objectContaining({p_order_ids:[order.id],p_location_id:branch.id}));
});

it("branch alone enables selection and combining without date filters",async()=>{
  const ordersQuery=queryResult([{...order,locations:branch,pickup_requests:[]}],null,1);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):ordersQuery);db.rpc.mockReturnValue(queryResult("invoice"));
  render(<AdminInvoices/>);await screen.findByText("INV-12");
  await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);
  expect(screen.getByRole("button",{name:"Select All Eligible Invoices"})).toBeEnabled();
  await userEvent.click(screen.getByRole("checkbox",{name:"Select order 12"}));
  await userEvent.click(screen.getByRole("button",{name:"Combine Invoices (1 selected)"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("create_weekly_invoice",expect.objectContaining({p_location_id:branch.id,p_start_date:order.order_date,p_end_date:order.order_date,p_order_ids:[order.id]})));
});
