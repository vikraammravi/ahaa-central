import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminBranches from "@/app/admin/branches/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch } from "@tests/mocks/fixtures";

it("admin branch columns keep the requested order",async()=>{
  db.from.mockReturnValue(queryResult([branch]));render(<AdminBranches/>);await screen.findByText(branch.name);expect(screen.getAllByRole("columnheader").map(cell=>cell.textContent)).toEqual(["Branch","Address","City","Phone","Branch Type",""]);
});
