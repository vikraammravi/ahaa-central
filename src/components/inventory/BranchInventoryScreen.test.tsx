import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchInventoryScreen } from "@/components/inventory/BranchInventoryScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { workspace, inventorySearchWorkspace } from "@tests/mocks/fixtures";

it("inventory history is separate and entry permissions are respected",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen/>);expect(await screen.findByText("Oshawa")).toBeVisible();expect(screen.queryByRole("button",{name:/Record Daily Inventory/})).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Update History"}));expect(screen.getByText("No submissions yet")).toBeVisible();
});

it("edits inventory inline and saves calculated closing with received checks",async()=>{
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  expect(screen.queryByRole("columnheader",{name:"Adjustment"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Opening for Idli Batter")).toBeDisabled();
  const used=screen.getByLabelText("Used for Idli Batter");await userEvent.clear(used);await userEvent.type(used,"3");
  expect(screen.getByLabelText("Closing for Idli Batter")).toHaveValue(9);
  expect(screen.queryByLabelText(/Received for/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_branch_inventory_day",expect.objectContaining({p_lines:[expect.objectContaining({opening_quantity:10,used_quantity:3,quantity:9,expected_received_quantity:2})]})));
  await waitFor(()=>expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument());
});

it("hides notes and warns before leaving unsaved edits",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"8");
  expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument();
  expect(screen.queryByRole("link",{name:"Place Order"})).not.toBeInTheDocument();
  const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
  await userEvent.click(screen.getByRole("button",{name:"Update History"}));
  expect(confirm).toHaveBeenCalled();expect(closing).toBeVisible();
  const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
  confirm.mockReturnValue(true);await userEvent.click(screen.getByRole("button",{name:"Cancel"}));
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});

it("saves a physical closing difference without requiring a notes input",async()=>{
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"8");
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_branch_inventory_day",expect.objectContaining({p_notes:expect.stringContaining("System record:"),p_lines:[expect.objectContaining({quantity:8})]})));
});

it("inventory separates units and searches only item names",async()=>{
  db.rpc.mockReturnValue(queryResult(inventorySearchWorkspace));render(<BranchInventoryScreen/>);await screen.findByText("Paper Bag");expect(screen.getByRole("columnheader",{name:"Unit"})).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search Name"),"paper");expect(screen.getByText("Paper Bag")).toBeVisible();expect(screen.queryByText("Idli Batter")).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Search Name"));await userEvent.type(screen.getByLabelText("Search Name"),"bucket");expect(screen.getByText("No inventory items match your search")).toBeVisible();
});

it("inventory conflicts keep edits and date navigation requires confirmation",async()=>{
  db.rpc.mockImplementation(name=>name==="branch_inventory_workspace"?queryResult(workspace):queryResult(null,{message:"Received stock changed. Refresh before saving."}));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  const used=screen.getByLabelText("Used for Idli Batter");await userEvent.clear(used);await userEvent.type(used,"3");
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  expect(await screen.findByText(/Received stock changed/)).toBeVisible();expect(used).toHaveValue(3);
  const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
  const date=screen.getByLabelText("Inventory date");
  fireEvent.change(date,{target:{value:"2026-10-10"}});
  expect(confirm).toHaveBeenCalled();expect(used).toBeVisible();
});
