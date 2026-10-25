import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CombinedInvoiceOrders } from "@/components/shared/CombinedInvoiceOrders";

it("branch order breakdown shows amounts without linking to mutable individual invoices",()=>{
  render(<CombinedInvoiceOrders orders={[{id:"order",order_number:12,order_date:"2026-10-12",total:50}]} isAdmin={false}/>);expect(screen.getByText("INV-12")).toBeVisible();expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
