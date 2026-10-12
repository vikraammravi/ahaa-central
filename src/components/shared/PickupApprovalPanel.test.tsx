import { pickupRequest as request } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickupApprovalPanel } from "@/components/shared/PickupApprovalPanel";

import { db } from "@tests/mocks/supabase";

it("pickup approval stays in a modal and approves extras with notes",async()=>{
  const reviewed=vi.fn();render(<PickupApprovalPanel request={request} canReview products={{line:"Idli Batter"}} onReviewed={reviewed}/>);expect(screen.queryByText("+2")).not.toBeInTheDocument();await userEvent.click(screen.getByRole("button",{name:"Review Pickup"}));expect(screen.getByText("+2")).toBeVisible();await userEvent.type(screen.getByLabelText("Notes"),"Extra stock available");await userEvent.click(screen.getByRole("button",{name:"Approve"}));expect(db.rpc).toHaveBeenCalledWith("review_pickup",expect.objectContaining({p_approve:true,p_note:"Extra stock available"}));expect(reviewed).toHaveBeenCalled();
});

it("branch pickup details do not expose admin review controls",async()=>{
  render(<PickupApprovalPanel request={request} canReview={false} products={{line:"Idli Batter"}} onReviewed={vi.fn()}/>);await userEvent.click(screen.getByRole("button",{name:"View Pickup Details"}));expect(screen.queryByRole("button",{name:"Approve"})).not.toBeInTheDocument();
});
