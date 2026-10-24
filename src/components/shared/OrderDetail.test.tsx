import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderDetail } from "@/components/shared/OrderDetail";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, item, order } from "@tests/mocks/fixtures";
import { invoiceLine } from "@tests/mocks/fixtures";
import { mockViewport } from "@tests/mocks/viewport";

it.each([390,820])("branch View Order shows item cards on %spx screens",async width=>{
  mockViewport(width);
  db.from.mockImplementation(table=>queryResult(table==="orders"?{...order,status:"READY",locations:{name:branch.name},weekly_invoices:null}:table==="order_lines"?[invoiceLine]:[]));
  render(<OrderDetail orderId={order.id} canEdit={false}/>);await screen.findByText(item.name);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();expect(screen.getByText("Requested",{selector:"dt"})).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Review Pickup"}));
  const dialog=within(screen.getByRole("dialog"));await userEvent.click(dialog.getByRole("button",{name:`Increase pickup ${item.name}`}));
  expect(dialog.getByLabelText(`Pickup quantity ${item.name}`)).toHaveValue(6);
});

it.each([false,true])("ready pickup permits increasing above prepared quantity (admin=%s)",async canEdit=>{
  db.from.mockImplementation(table=>queryResult(table==="orders"?{...order,status:"READY",locations:{name:branch.name},weekly_invoices:null}:table==="order_lines"?[{id:"line",quantity:5,fulfilled_quantity:5,unit_price:10,is_taxable:false,shortage_reason:null,catalog_items:{name:item.name,unit_type:"Bucket"}}]:[]));
  render(<OrderDetail orderId="order" canEdit={canEdit}/>);await userEvent.click(await screen.findByRole("button",{name:"Review Pickup"}));await userEvent.click(screen.getByRole("button",{name:`Increase pickup ${item.name}`}));expect(within(screen.getByRole("dialog")).getByLabelText(`Pickup quantity ${item.name}`)).toHaveValue(6);await userEvent.click(screen.getByRole("button",{name:"Request Approval"}));expect(db.rpc).toHaveBeenCalledWith("submit_pickup",expect.objectContaining({p_quantities:[{line_id:"line",quantity:6}]}));
});

it.each(["SUBMITTED","PREPARING"])("branch edit link is available only for Submitted (%s)",async status=>{
  db.from.mockImplementation(table=>queryResult(table==="orders"?{...order,status,locations:{name:branch.name},weekly_invoices:null}:[]));
  render(<OrderDetail orderId={order.id} canEdit={false}/>);await screen.findByText(`Order #${order.order_number}`);
  const link=screen.queryByRole("link",{name:"Edit Order"});
  if(status==="SUBMITTED")expect(link).toHaveAttribute("href",`/branch/order?edit=${order.id}`);else expect(link).not.toBeInTheDocument();
});
