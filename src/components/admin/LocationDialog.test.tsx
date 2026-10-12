import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationDialog } from "@/components/admin/LocationDialog";
import { branch } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("location edits retain address and branch type",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);render(<LocationDialog location={branch} open onOpenChange={vi.fn()}/>);await userEvent.clear(screen.getByLabelText("City"));await userEvent.type(screen.getByLabelText("City"),"Toronto");await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));expect(query.update).toHaveBeenCalledWith(expect.objectContaining({city:"Toronto",address:branch.address,is_central:false}));
});
