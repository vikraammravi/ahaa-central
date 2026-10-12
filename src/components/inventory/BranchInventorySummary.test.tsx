import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BranchInventorySummary } from "@/components/inventory/BranchInventorySummary";
import { db, queryResult } from "@tests/mocks/supabase";
import { workspace } from "@tests/mocks/fixtures";

it("inventory summary identifies its updater",async()=>{
  db.rpc.mockReturnValue(queryResult({...workspace,latest:{id:"count",count_date:"2026-10-12",submitted_at:"2026-10-12T12:00:00Z",submitted_name:"Employee One",notes:"",flow_version:2}}));render(<BranchInventorySummary/>);expect(await screen.findByText(/Employee One/)).toBeVisible();expect(screen.getByRole("link",{name:"View Inventory"})).toHaveAttribute("href","/branch/inventory");
});
