import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BranchShell } from "@/components/branch/BranchShell";
import { EmployeeShell } from "@/components/employee/EmployeeShell";

it.each([AdminShell,BranchShell,EmployeeShell])("role shells keep password changes out of navigation",async Shell=>{
  render(<Shell><p>Page content</p></Shell>);expect(screen.getByText("Page content")).toBeVisible();expect(screen.queryByRole("button",{name:"Change Password"})).not.toBeInTheDocument();expect(screen.getAllByRole("link").some(link=>link.getAttribute("href")?.endsWith("/profile"))).toBe(true);
});

it("admin sidebar starts with Dashboard and anchors My Profile in the footer",()=>{
  render(<AdminShell><p>Page content</p></AdminShell>);
  const sidebar=within(screen.getByRole("complementary"));
  const navigation=sidebar.getAllByRole("navigation");
  expect(within(navigation[0]).getAllByRole("link")[0]).toHaveTextContent("Dashboard");
  expect(within(navigation[navigation.length-1]).getByRole("link",{name:"My Profile"})).toHaveAttribute("href","/admin/profile");
});

it.each([BranchShell,EmployeeShell])("branch role sidebar icons match admin's inventory, catering and profile icons",Shell=>{
  render(<Shell><p>Page content</p></Shell>);const sidebar=within(screen.getByRole("complementary"));
  expect(sidebar.getByRole("link",{name:"Catering"}).querySelector("svg")).toHaveClass("lucide-utensils-crossed");
  expect(sidebar.getByRole("link",{name:"My Profile"}).querySelector("svg")).toHaveClass("lucide-user-round");
  expect(sidebar.getByRole("link",{name:/Inventory/}).querySelector("svg")).toHaveClass("lucide-package");
});

it.each([BranchShell,EmployeeShell])("branch roles use bottom navigation without a mobile sidebar menu",Shell=>{
  render(<Shell><p>Page content</p></Shell>);
  expect(screen.queryByRole("button",{name:"Open menu"})).not.toBeInTheDocument();
  const mobileNav=screen.getAllByRole("navigation").find(nav=>nav.classList.contains("fixed"));
  expect(mobileNav).toBeDefined();
  expect(within(mobileNav!).getByRole("link",{name:/Inventory/})).toBeVisible();
  expect(screen.getAllByRole("link",{name:"My Profile"}).length).toBeGreaterThan(0);
});

it("admin keeps the mobile sidebar menu",()=>{
  render(<AdminShell><p>Page content</p></AdminShell>);
  expect(screen.getByRole("button",{name:"Open menu"})).toBeInTheDocument();
});
