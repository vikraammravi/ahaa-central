import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BranchInvoices from "@/app/branch/invoices/page";
import { order } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("branch orders keep pickup decision in its own column",async()=>{
  db.from.mockReturnValue(queryResult([{...order,weekly_invoices:null,pickup_requests:[{status:"REJECTED",requested_at:"2026-10-12"}]}],null,1));render(<BranchInvoices/>);expect(await screen.findByText("Rejected")).toBeVisible();expect(screen.getByRole("columnheader",{name:"Pickup Approval"})).toBeVisible();
});
