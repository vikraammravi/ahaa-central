import { cateringEvent as event } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CateringEventDialog } from "@/components/branch/CateringEventDialog";

import { db, queryResult } from "@tests/mocks/supabase";

it("catering edits recalculate the balance",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);render(<CateringEventDialog event={event} locationId="branch" open onOpenChange={vi.fn()}/>);const advance=screen.getByLabelText(/Advance Paid/i);await userEvent.clear(advance);await userEvent.type(advance,"40");await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));expect(query.update).toHaveBeenCalledWith(expect.objectContaining({advance_paid:40,balance_due:60}));
});
