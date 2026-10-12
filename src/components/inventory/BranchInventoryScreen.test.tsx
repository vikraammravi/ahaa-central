import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchInventoryScreen } from "@/components/inventory/BranchInventoryScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { workspace } from "@tests/mocks/fixtures";

it("inventory history is separate and entry permissions are respected",async()=>{
  db.rpc.mockReturnValue(queryResult(workspace));render(<BranchInventoryScreen/>);expect(await screen.findByText("Oshawa")).toBeVisible();expect(screen.queryByRole("button",{name:/Record Daily Inventory/})).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Update History"}));expect(screen.getByText("No submissions yet")).toBeVisible();
});
