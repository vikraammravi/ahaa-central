import { expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrders from "@/app/admin/orders/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, order } from "@tests/mocks/fixtures";
import { mockViewport } from "@tests/mocks/viewport";

it("admin tablet cards keep status updates and pickup approval available",async()=>{
  mockViewport(900);const query=queryResult([{...order,status:"SUBMITTED",locations:{name:branch.name},pickup_requests:[{status:"APPROVED",requested_at:"2026-10-12"}]}],null,1);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):query);
  render(<AdminOrders/>);await screen.findByText(`Order #${order.order_number}`);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Approved")).toBeVisible();
  expect(screen.getByRole("link",{name:"View Order"})).toHaveAttribute("href",`/admin/orders/${order.id}`);
  await userEvent.selectOptions(screen.getByLabelText(`Status for order ${order.order_number}`),"PREPARING");
  expect(query.update).toHaveBeenCalledWith({status:"PREPARING"});
});

it("admin order approval remains a separate column",async()=>{
  db.from.mockReturnValue(queryResult([{...order,locations:{name:branch.name},pickup_requests:[{status:"APPROVED",requested_at:"2026-10-12"}]}],null,1));render(<AdminOrders/>);expect(await screen.findByText("Approved")).toBeVisible();expect(screen.getByRole("columnheader",{name:"Pickup Approval"})).toBeVisible();
});

it("filters branch orders by branch and date before pagination",async()=>{
  const query=queryResult([],null,0);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):query);
  render(<AdminOrders/>);await screen.findByRole("option",{name:branch.name});
  await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("location_id",branch.id));
  fireEvent.change(screen.getByLabelText("Order Date"),{target:{value:"2026-10-01"}});
  await waitFor(()=>expect(query.gte).toHaveBeenCalledWith("order_date","2026-10-01"));
  expect(query.lte).toHaveBeenCalledWith("order_date","2026-10-01");
  expect(screen.queryByLabelText("To Date")).not.toBeInTheDocument();
  expect(query.range).toHaveBeenLastCalledWith(0,24);
});
