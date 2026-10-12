import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PickupApprovalBadge } from "@/components/shared/PickupApprovalBadge";

it("pickup badge shows the latest review instead of an older approval",()=>{
    render(<PickupApprovalBadge requests={[{status:"APPROVED",requested_at:"2026-10-01"},{status:"REJECTED",requested_at:"2026-10-12"}]}/>);expect(screen.getByText("Rejected")).toBeVisible();expect(screen.queryByText("Approved")).not.toBeInTheDocument();
  });

it("empty approvals show a neutral placeholder",()=>{render(<PickupApprovalBadge requests={[]}/>);expect(screen.getByText("—")).toBeVisible();});
