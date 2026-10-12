import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/branch/home/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, profile, workspace } from "@tests/mocks/fixtures";

it("branch dashboard displays its assigned branch and inventory summary",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:table==="locations"?branch:[]));db.rpc.mockReturnValue(queryResult(workspace));render(<Home/>);expect(await screen.findByText(/Oshawa/)).toBeVisible();expect(screen.getByRole("link",{name:"View Inventory"})).toBeVisible();
});
