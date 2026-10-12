import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryEntryDialog } from "@/components/inventory/InventoryEntryDialog";
import { workspace } from "@tests/mocks/fixtures";
import { db } from "@tests/mocks/supabase";

it("inventory carries opening and received quantities into closing",async()=>{
  const saved=vi.fn();render(<InventoryEntryDialog workspace={workspace} onClose={vi.fn()} onSaved={saved}/>);expect(screen.getByLabelText("Opening")).toBeDisabled();expect(screen.getByLabelText("Closing")).toHaveValue(12);
  await userEvent.clear(screen.getByLabelText("Used"));await userEvent.type(screen.getByLabelText("Used"),"3");expect(screen.getByLabelText("Closing")).toHaveValue(9);
  await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));expect(db.rpc).toHaveBeenCalledWith("save_branch_inventory_day",expect.objectContaining({p_lines:[expect.objectContaining({opening_quantity:10,used_quantity:3,quantity:9,expected_received_quantity:2})]}));expect(saved).toHaveBeenCalled();
});

it("physical inventory adjustments require notes",async()=>{
  render(<InventoryEntryDialog workspace={workspace} onClose={vi.fn()} onSaved={vi.fn()}/>);await userEvent.clear(screen.getByLabelText("Closing"));await userEvent.type(screen.getByLabelText("Closing"),"8");expect(screen.getByLabelText(/Notes/)).toBeRequired();await userEvent.click(screen.getByRole("button",{name:"Save Inventory"}));expect(db.rpc).not.toHaveBeenCalled();
});
