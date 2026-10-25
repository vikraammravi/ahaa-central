import { expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchOrder from "@/app/branch/order/page";
import { profile, item, workspace, catalogFilterItems } from "@tests/mocks/fixtures";
import { db, queryResult, router } from "@tests/mocks/supabase";

it("branch order requires review before submitting selected items",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});const orderQuery=queryResult({id:"new-order"});const linesQuery=queryResult(null);
  db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):table==="catalog_items"?queryResult([item]):table==="orders"?orderQuery:linesQuery);db.rpc.mockImplementation(name=>queryResult(name==="create_branch_order"?"new-order":workspace));
  render(<BranchOrder/>);await userEvent.click(await screen.findByRole("button",{name:`Increase ${item.name}`}));await userEvent.click(screen.getByRole("button",{name:"Place Order"}));expect(orderQuery.insert).not.toHaveBeenCalled();const dialog=screen.getByRole("dialog");expect(within(dialog).getByText(item.name)).toBeVisible();await userEvent.click(within(dialog).getByRole("button",{name:"Submit Order"}));await waitFor(()=>expect(router.push).toHaveBeenCalledWith("/branch/invoices"));expect(db.rpc).toHaveBeenCalledWith("create_branch_order",expect.objectContaining({p_quantities:[{item_id:item.id,quantity:1}]}));expect(linesQuery.insert).not.toHaveBeenCalled();
});

it("filters branch stock by threshold status while preserving the selected order",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):queryResult(catalogFilterItems));
  db.rpc.mockReturnValue(queryResult({...workspace,items:[{...workspace.items[0],quantity:3}]}));render(<BranchOrder/>);
  await userEvent.click(await screen.findByRole("button",{name:`Increase ${item.name}`}));
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"out-of-stock");
  expect(screen.getByText("No products match these filters")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Place Order"}));
  expect(within(screen.getByRole("dialog")).getByText(item.name)).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit Order"}));
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"in-stock");
  expect(screen.getByLabelText(`Order quantity for ${item.name}`)).toHaveValue(1);
  expect(screen.getByRole("columnheader",{name:"Stock Status"})).toBeVisible();
});

it("table supports typing quantities and retains selections when filtered",async()=>{
  db.from.mockImplementation(table=>table==="catalog_items"?queryResult(catalogFilterItems):queryResult(null));
  render(<BranchOrder/>);
  const input=await screen.findByLabelText(`Order quantity for ${item.name}`);
  expect(screen.getByRole("columnheader",{name:"Order Quantity"})).toBeVisible();
  await userEvent.type(input,"3");expect(input).toHaveValue(3);
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Packaging");
  expect(screen.queryByLabelText(`Order quantity for ${item.name}`)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Place Order"}));
  expect(within(screen.getByRole("dialog")).getByText(item.name)).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit Order"}));
  await userEvent.selectOptions(screen.getByLabelText("Category"),"");
  expect(screen.getByLabelText(`Order quantity for ${item.name}`)).toHaveValue(3);
  await userEvent.type(screen.getByLabelText("Search products"),"paper");
  expect(screen.getByText("Paper Bag")).toBeVisible();expect(screen.queryByText(item.name)).not.toBeInTheDocument();
});

it("table clamps typed quantities to available whole units",async()=>{
  db.from.mockReturnValue(queryResult([item]));render(<BranchOrder/>);
  const input=await screen.findByLabelText(`Order quantity for ${item.name}`);
  await userEvent.type(input,"999");expect(input).toHaveValue(item.available_stock);
  expect(screen.getByRole("button",{name:`Increase ${item.name}`})).toBeDisabled();
  await userEvent.clear(input);expect(screen.getByRole("button",{name:`Decrease ${item.name}`})).toBeDisabled();
  expect(screen.queryByRole("button",{name:"Place Order"})).not.toBeInTheDocument();
});
