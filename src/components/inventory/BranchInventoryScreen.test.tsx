import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchInventoryScreen } from "@/components/inventory/BranchInventoryScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { workspace, inventorySearchWorkspace } from "@tests/mocks/fixtures";

it("inventory history is separate and entry permissions are respected",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen/>);expect(await screen.findByText("Oshawa")).toBeVisible();expect(screen.queryByRole("button",{name:/Record Daily Inventory/})).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Update History"}));expect(screen.getByText("No submissions yet")).toBeVisible();
});

it("inventory separates units and searches only item names",async()=>{
  db.rpc.mockReturnValue(queryResult(inventorySearchWorkspace));render(<BranchInventoryScreen/>);await screen.findByText("Paper Bag");expect(screen.getByRole("columnheader",{name:"Unit"})).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search Name"),"paper");expect(screen.getByText("Paper Bag")).toBeVisible();expect(screen.queryByText("Idli Batter")).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Search Name"));await userEvent.type(screen.getByLabelText("Search Name"),"bucket");expect(screen.getByText("No inventory items match your search")).toBeVisible();
});
