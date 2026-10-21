import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stock from "@/app/admin/stock/page";
import { item, catalogFilterItems } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("common Edit unlocks quantities; Save stages and Broadcast persists with conflict checks",async()=>{
  db.from.mockReturnValue(queryResult([item]));render(<Stock/>);await screen.findByText(item.name);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByLabelText(`Available stock for ${item.name}`);
  await userEvent.clear(input);await userEvent.type(input,"15");
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(db.rpc).not.toHaveBeenCalled();expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getByText("Pending broadcast")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:15,expected_stock:20,expected_updated_at:item.updated_at}]}));
  await waitFor(()=>expect(screen.queryByText("Pending broadcast")).not.toBeInTheDocument());
});

it("stock combines category and threshold-based status filters",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems.map((row,index)=>({...row,available_stock:[20,5,0][index],low_stock_threshold:20}))));
  render(<Stock/>);await screen.findByText("Paper Bag");
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
  db.from.mockReturnValue(queryResult(catalogFilterItems));render(<Stock/>);await screen.findByText(item.name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByLabelText(`Available stock for ${item.name}`);
  await userEvent.clear(input);await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(screen.getByText(/Stock must be a nonnegative whole number/)).toBeVisible();
  await userEvent.type(input,"15");
  await userEvent.type(screen.getByLabelText("Search products"),"paper");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  const unload=new Event("beforeunload",{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(true);
  const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
  await userEvent.click(screen.getByRole("button",{name:"Discard Changes"}));expect(confirm).toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeEnabled();
  confirm.mockReturnValue(true);await userEvent.click(screen.getByRole("button",{name:"Discard Changes"}));
  expect(screen.getByRole("button",{name:"Broadcast Changes"})).toBeDisabled();expect(db.rpc).not.toHaveBeenCalled();
});

it("broadcast errors keep saved quantities for review",async()=>{
  db.from.mockReturnValue(queryResult([item]));db.rpc.mockReturnValue(queryResult(null,{message:"Stock changed elsewhere"}));
  render(<Stock/>);await screen.findByText(item.name);await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByRole("spinbutton");await userEvent.clear(input);await userEvent.type(input,"12");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  expect(await screen.findByText(/Stock changed elsewhere/)).toBeVisible();expect(screen.getByText("Pending broadcast")).toBeVisible();
});

it("saved stock previews use matching status filters and cancel preserves staged edits",async()=>{
  db.from.mockReturnValue(queryResult([item]));render(<Stock/>);await screen.findByText(item.name);
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  const input=screen.getByRole("spinbutton");await userEvent.clear(input);await userEvent.type(input,"0");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await userEvent.selectOptions(screen.getByLabelText("Stock Status"),"out-of-stock");
  expect(screen.getByText(item.name)).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  await userEvent.type(screen.getByRole("spinbutton"),"5");
  vi.spyOn(window,"confirm").mockReturnValue(true);
  await userEvent.click(screen.getByRole("button",{name:"Cancel"}));
  await userEvent.click(screen.getByRole("button",{name:"Broadcast Changes"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:0,expected_stock:20,expected_updated_at:item.updated_at}]}));
});
