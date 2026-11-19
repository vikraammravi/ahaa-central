import { expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrders from "@/features/orders/screens/AdminOrdersScreen";
import { db, queryResult, router } from "@tests/mocks/supabase";
import { branch, order } from "@tests/mocks/fixtures";
import { mockViewport } from "@tests/mocks/viewport";

it("opens pickup review when admin selects Completed for a ready order", async () => {
  const query = queryResult([{...order, status:"READY", locations:{name:branch.name}, pickup_requests:[]}], null, 1);
  db.from.mockImplementation(table => table === "locations" ? queryResult([branch]) : query);
  render(<AdminOrders/>);
  await userEvent.selectOptions(await screen.findByLabelText(`Status for order ${order.order_number}`), "COMPLETED");
  expect(router.push).toHaveBeenCalledWith(`/admin/orders/${order.id}?pickup=1`);
  expect(query.update).not.toHaveBeenCalled();
});

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

it.each([390,820,1280])("shows completed pickup date without a status dropdown at %spx",async width=>{
  mockViewport(width);
  const completed={...order,status:"COMPLETED",pickup_date:"2026-10-14",created_at:"2026-10-12T12:00:00Z",locations:{name:branch.name},pickup_requests:[]};
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):queryResult([completed],null,1));
  render(<AdminOrders/>);
  expect(await screen.findByText("Completed")).toBeVisible();
  expect(screen.queryByLabelText(`Status for order ${order.order_number}`)).not.toBeInTheDocument();
  if(width===1280){
    expect(screen.getByRole("columnheader",{name:"Pickup Date"})).toBeVisible();
    expect(screen.getByText("Oct 14, 2026")).toBeVisible();
    expect(screen.getByText("Oct 12, 2026")).toBeVisible();
  } else {
    expect(screen.getByText(/Pickup: Oct 14, 2026/)).toBeVisible();
    expect(screen.getByText(/Submitted: Oct 12, 2026/)).toBeVisible();
  }
  expect(screen.queryByText(/8:00 AM/)).not.toBeInTheDocument();
});

it("shows an empty pickup date for a ready order and keeps its status selector",async()=>{
  mockViewport(1280);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):queryResult([{...order,status:"READY",pickup_date:null,locations:{name:branch.name},pickup_requests:[]}],null,1));
  render(<AdminOrders/>);
  expect(await screen.findByLabelText(`Status for order ${order.order_number}`)).toBeEnabled();
  expect(screen.getByRole("columnheader",{name:"Pickup Date"})).toBeVisible();
  const index=screen.getAllByRole("columnheader").findIndex(header=>header.textContent==="Pickup Date");
  expect(screen.getByRole("row",{name:/#12/}).querySelectorAll("td")[index]).toHaveTextContent("—");
});
