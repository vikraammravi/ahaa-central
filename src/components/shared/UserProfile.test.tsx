import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserProfile } from "@/components/shared/UserProfile";
import { branch, profile } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it.each(["CENTRAL_ADMIN","BRANCH_MANAGER","BRANCH_EMPLOYEE"] as const)("%s uses the shared profile and password entry",async role=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockImplementation(table=>queryResult(table==="profiles"?{...profile,role,location_id:role==="CENTRAL_ADMIN"?null:branch.id}:{name:branch.name}));
  render(<UserProfile/>);expect(await screen.findByText(profile.email!)).toBeVisible();expect(screen.getByRole("button",{name:"Change Password"})).toBeVisible();expect(await screen.findByText(role==="CENTRAL_ADMIN"?"Central Kitchen":branch.name)).toBeVisible();
});
