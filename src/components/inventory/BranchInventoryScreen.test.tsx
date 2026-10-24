import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchInventoryScreen } from "@/components/inventory/BranchInventoryScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { workspace, inventorySearchWorkspace } from "@tests/mocks/fixtures";
import { mockViewport } from "@tests/mocks/viewport";

it("tablet inventory uses cards and retains the bottom save controls",async()=>{
  mockViewport(900);db.rpc.mockReturnValue(queryResult(workspace));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Idli Batter");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  expect(screen.getByRole("button",{name:"Save Inventory"})).toBeVisible();
  expect(screen.getByRole("button",{name:"Show changed only"})).toBeVisible();
});

it("history starts with a compact empty date filter independent of the inventory date",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen/>);
  await screen.findByText("Oshawa");
  expect(screen.getByLabelText("Inventory date")).toHaveValue(workspace.today);
  await userEvent.click(screen.getByRole("button",{name:"Update History"}));
  expect(screen.getByLabelText("Inventory date")).toHaveValue("");
  expect(screen.getByLabelText("Inventory date").parentElement?.parentElement).toHaveClass("max-w-[200px]");
  fireEvent.change(screen.getByLabelText("Inventory date"),{target:{value:"2026-10-10"}});
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("branch_inventory_workspace",expect.objectContaining({p_count_date:"2026-10-10"})));
  await userEvent.click(screen.getByRole("button",{name:"Inventory"}));
  expect(screen.getByLabelText("Inventory date")).toHaveValue(workspace.today);
});

it("mobile cards preserve hidden edits and save every item from the bottom action bar",async()=>{
  vi.mocked(window.matchMedia).mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()} as unknown as MediaQueryList);
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?inventorySearchWorkspace:null));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Paper Bag");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Unit: Bag")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"9");
  expect(screen.getByLabelText("Used for Idli Batter")).toHaveTextContent("3");
  await userEvent.click(screen.getByRole("button",{name:"Show changed only"}));
  expect(screen.queryByText("Paper Bag")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Search & filters"}));
  await userEvent.type(screen.getByLabelText("Search Name"),"paper");
  await userEvent.click(screen.getByRole("button",{name:"Show results"}));
  expect(screen.getByText("No inventory items match your search")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Show changed only"}));
  expect(screen.getByText("Paper Bag")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_branch_inventory_day",expect.objectContaining({p_lines:[expect.objectContaining({item_id:"item",quantity:9,used_quantity:3}),expect.objectContaining({item_id:"packaging",quantity:12})]})));
});

it("inventory history is separate and entry permissions are respected",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen/>);expect(await screen.findByText("Oshawa")).toBeVisible();expect(screen.queryByRole("button",{name:/Record Daily Inventory/})).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Update History"}));expect(screen.getByText("No submissions yet")).toBeVisible();
});

it("edits only wasted and closing and derives used from the received stock snapshot",async()=>{
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  expect(screen.queryByRole("columnheader",{name:"Adjustment"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Opening for Idli Batter")).toHaveTextContent("10");
  expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"9");
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

  await userEvent.click(screen.getByRole("button",{name:"Update History"}));
  expect(screen.getByRole("dialog",{name:"Unsaved changes"})).toBeVisible();await userEvent.click(screen.getByRole("button",{name:"Keep Editing"}));expect(closing).toBeVisible();
  const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
  await userEvent.click(screen.getByRole("button",{name:"Cancel"}));await userEvent.click(screen.getByRole("button",{name:"Discard Changes"}));
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});

it("saves a physical closing difference without requiring a notes input",async()=>{
  db.rpc.mockImplementation(name=>queryResult(name==="branch_inventory_workspace"?workspace:null));
  render(<BranchInventoryScreen canSubmit/>);await screen.findByText("Oshawa");
  await userEvent.click(screen.getByRole("button",{name:"Edit Inventory"}));
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"8");
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_branch_inventory_day",expect.objectContaining({p_notes:"",p_lines:[expect.objectContaining({quantity:8,used_quantity:4})]})));
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
  const closing=screen.getByLabelText("Closing for Idli Batter");await userEvent.clear(closing);await userEvent.type(closing,"9");
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));
  expect(await screen.findByText(/Received stock changed/)).toBeVisible();expect(closing).toHaveValue(9);

  const date=screen.getByLabelText("Inventory date");
  fireEvent.change(date,{target:{value:"2026-10-10"}});
  expect(screen.getByRole("dialog",{name:"Unsaved changes"})).toBeVisible();await userEvent.click(screen.getByRole("button",{name:"Keep Editing"}));expect(closing).toBeVisible();
});
