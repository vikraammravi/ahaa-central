import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { branchDashboard } from "@tests/mocks/branch-dashboard";
import Home from "@/features/dashboard/screens/BranchDashboardScreen";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, profile, workspace } from "@tests/mocks/fixtures";

it("branch dashboard displays its assigned branch and inventory summary",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:table==="locations"?branch:[]));db.rpc.mockImplementation(name=>queryResult(name==="branch_dashboard_summary"?branchDashboard:workspace));render(<Home/>);expect(await screen.findByText(/Oshawa/)).toBeVisible();expect(screen.getByRole("link",{name:"View Inventory"})).toBeVisible();
});

it("loads bounded dashboard data instead of order and catering histories",async()=>{
 db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
 db.from.mockImplementation(table=>queryResult(table==="profiles"?profile:[]));
 db.rpc.mockImplementation(name=>queryResult(name==="branch_dashboard_summary"?branchDashboard:workspace));
 render(<Home/>);
 await screen.findByText("Oshawa");
 expect(db.rpc).toHaveBeenCalledWith("branch_dashboard_summary");
 expect(db.from.mock.calls.flat()).not.toContain("orders");
 expect(db.from.mock.calls.flat()).not.toContain("catering_events");
 expect(screen.getByText("7")).toBeVisible();
});
