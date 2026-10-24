import { expect,it } from "vitest";
import { render,screen,within,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchOrderForm } from "./BranchOrderForm";
import { db,queryResult,router } from "@tests/mocks/supabase";
import { item,profile,submittedOrderForEdit,workspace } from "@tests/mocks/fixtures";

function setup(status="SUBMITTED"){
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  const orders=queryResult({...submittedOrderForEdit,status});
  db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):table==="catalog_items"?queryResult([{...item,default_price:25}]):orders);
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null));
  return orders;
}

it("reopens submitted quantities and updates the original order after review",async()=>{
  const orders=setup();render(<BranchOrderForm editOrderId={submittedOrderForEdit.id}/>);
  const input=await screen.findByLabelText(`Order quantity for ${item.name}`);expect(input).toHaveValue(5);
  await userEvent.click(screen.getByRole("button",{name:`Increase ${item.name}`}));
  await userEvent.click(screen.getByRole("button",{name:"Review Changes"}));
  const dialog=within(screen.getByRole("dialog"));expect(dialog.getAllByText("CA$60.00").length).toBeGreaterThan(0);
  await userEvent.click(dialog.getByRole("button",{name:"Update Order"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("edit_submitted_branch_order",{p_order_id:submittedOrderForEdit.id,p_quantities:[{item_id:item.id,quantity:6}],p_expected_updated_at:submittedOrderForEdit.updated_at}));
  expect(orders.insert).not.toHaveBeenCalled();expect(router.push).toHaveBeenCalledWith(`/branch/invoices/${submittedOrderForEdit.id}`);
});

it("does not load an order for editing once preparation has started",async()=>{
  setup("PREPARING");render(<BranchOrderForm editOrderId={submittedOrderForEdit.id}/>);
  expect(await screen.findByText(/Only Submitted orders can be edited/)).toBeVisible();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();expect(db.rpc).not.toHaveBeenCalledWith("edit_submitted_branch_order",expect.anything());
});

it("retains the edited quantities if central kitchen advances the order before saving",async()=>{
  setup();render(<BranchOrderForm editOrderId={submittedOrderForEdit.id}/>);
  await screen.findByLabelText(`Order quantity for ${item.name}`);
  await userEvent.click(screen.getByRole("button",{name:"Review Changes"}));
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null,name==="edit_submitted_branch_order"?{message:"Only Submitted orders can be edited."}:null));
  await userEvent.click(screen.getByRole("button",{name:"Update Order"}));
  await waitFor(()=>expect(within(screen.getByRole("dialog")).getByText("Only Submitted orders can be edited.")).toBeVisible());
  expect(router.push).not.toHaveBeenCalled();
});
