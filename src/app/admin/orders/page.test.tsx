import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminOrders from "@/app/admin/orders/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, order } from "@tests/mocks/fixtures";

it("admin order approval remains a separate column",async()=>{
  db.from.mockReturnValue(queryResult([{...order,locations:{name:branch.name},pickup_requests:[{status:"APPROVED",requested_at:"2026-10-12"}]}],null,1));render(<AdminOrders/>);expect(await screen.findByText("Approved")).toBeVisible();expect(screen.getByRole("columnheader",{name:"Pickup Approval"})).toBeVisible();
});
