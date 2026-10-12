import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmployeeShell } from "@/components/employee/EmployeeShell";

it("employees cannot navigate to orders or invoices",()=>{
  render(<EmployeeShell><p>Inventory</p></EmployeeShell>);expect(screen.queryByRole("link",{name:"Invoices"})).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Place Order"})).not.toBeInTheDocument();
});
