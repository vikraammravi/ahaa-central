import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BranchShell } from "@/components/branch/BranchShell";
import { EmployeeShell } from "@/components/employee/EmployeeShell";

it.each([AdminShell,BranchShell,EmployeeShell])("role shells keep password changes out of navigation",async Shell=>{
  render(<Shell><p>Page content</p></Shell>);expect(screen.getByText("Page content")).toBeVisible();expect(screen.queryByRole("button",{name:"Change Password"})).not.toBeInTheDocument();expect(screen.getAllByRole("link").some(link=>link.getAttribute("href")?.endsWith("/profile"))).toBe(true);
});
