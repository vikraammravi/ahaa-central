import { installCatalogRpc } from "@tests/mocks/catalog";
import { expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stock from "@/app/admin/stock/page";
import { item, catalogFilterItems,pagedCatalogItems } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";
import { mockViewport } from "@tests/mocks/viewport";

it("keeps staged stock updates from different pages until one broadcast",async()=>{
  db.from.mockReturnValue(queryResult(pagedCatalogItems));installCatalogRpc();render(<Stock/>);
  await screen.findByText(pagedCatalogItems[0].name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const first=screen.getByLabelText(`Available stock for ${pagedCatalogItems[0].name}`);await userEvent.clear(first);await userEvent.type(first,"15");
  expect(screen.getByRole("button",{name:"Next"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Next"})).toBeEnabled());
  await userEvent.click(screen.getByRole("button",{name:"Next"}));await screen.findByText(pagedCatalogItems[25].name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const second=screen.getByLabelText(`Available stock for ${pagedCatalogItems[25].name}`);await userEvent.clear(second);await userEvent.type(second,"9");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[expect.objectContaining({id:pagedCatalogItems[0].id,available_stock:15}),expect.objectContaining({id:pagedCatalogItems[25].id,available_stock:9})]}));
});

it("admin tablet stock cards preserve edit, save and separate broadcast",async()=>{
  mockViewport(900);db.from.mockReturnValue(queryResult([item]));
  installCatalogRpc();render(<Stock/>);await screen.findByText(item.name);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByLabelText(`Available stock for ${item.name}`);await userEvent.clear(input);await userEvent.type(input,"15");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(db.rpc).not.toHaveBeenCalledWith("save_daily_stock",expect.anything());expect(screen.getByText("Pending broadcast")).toBeVisible();
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeEnabled();
});

it("common Edit unlocks quantities; Save stages and Broadcast persists with conflict checks",async()=>{
  db.from.mockReturnValue(queryResult([item]));installCatalogRpc();render(<Stock/>);await screen.findByText(item.name);
  expect(screen.queryByRole("columnheader",{name:"Rate"})).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader",{name:"Tax"})).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader",{name:"Threshold"})).not.toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByLabelText(`Available stock for ${item.name}`);
  await userEvent.clear(input);await userEvent.type(input,"15");
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(db.rpc).not.toHaveBeenCalledWith("save_daily_stock",expect.anything());expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByText("Pending broadcast")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:15,expected_stock:20,expected_updated_at:item.updated_at}]}));
  await waitFor(()=>expect(screen.queryByText("Pending broadcast")).not.toBeInTheDocument());
});

it("stock combines category and threshold-based status filters",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems.map((row,index)=>({...row,available_stock:[20,5,0][index],low_stock_threshold:20}))));
  installCatalogRpc();render(<Stock/>);await screen.findByText("Paper Bag");
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"out-of-stock");
  expect(screen.queryByText(item.name)).not.toBeInTheDocument();expect(screen.getByText("Paper Bag")).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Desserts");
  expect(screen.getByText("No products match these filters")).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"low-stock");
  expect(screen.getByText("Milk Sweet")).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Category"),"");
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"in-stock");
  expect(screen.getByText(item.name)).toBeVisible();
});

it("validates quantities, retains hidden edits, and warns before discarding",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems));installCatalogRpc();render(<Stock/>);await screen.findByText(item.name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByLabelText(`Available stock for ${item.name}`);
  await userEvent.clear(input);await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(screen.getByText(/Stock must be a nonnegative whole number/)).toBeVisible();
  await userEvent.type(input,"15");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await userEvent.type(screen.getByLabelText("Search products"),"paper");
  await waitFor(()=>expect(screen.queryByText(item.name)).not.toBeInTheDocument());
  const unload=new Event("beforeunload",{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(true);

  await userEvent.click(screen.getByRole("button",{name:"Discard Changes"}));await userEvent.click(screen.getByRole("button",{name:"Keep Editing"}));
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeEnabled();
  await userEvent.click(screen.getByRole("button",{name:"Discard Changes"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Discard Changes"}));
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeDisabled();expect(db.rpc).not.toHaveBeenCalledWith("save_daily_stock",expect.anything());
});

it("broadcast errors keep saved quantities for review",async()=>{
  db.from.mockReturnValue(queryResult([item]));db.rpc.mockReturnValue(queryResult(null,{message:"Stock changed elsewhere"}));
  installCatalogRpc();render(<Stock/>);await screen.findByText(item.name);await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByRole("spinbutton");await userEvent.clear(input);await userEvent.type(input,"12");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  expect(await screen.findByText(/Stock changed elsewhere/)).toBeVisible();expect(screen.getByText("Pending broadcast")).toBeVisible();
});

it("saved stock previews use matching status filters and cancel preserves staged edits",async()=>{
  db.from.mockReturnValue(queryResult([item]));installCatalogRpc();render(<Stock/>);await screen.findByText(item.name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByRole("spinbutton");await userEvent.clear(input);await userEvent.type(input,"0");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"out-of-stock");
  expect(screen.getByText(item.name)).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  await userEvent.type(screen.getByRole("spinbutton"),"5");

  await userEvent.click(screen.getByRole("button",{name:"Cancel"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Discard Changes"}));
  await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:0,expected_stock:20,expected_updated_at:item.updated_at}]}));
});
