import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CombinedInvoiceOrders } from "@/components/shared/CombinedInvoiceOrders";

it("combined order links retain branch routes",()=>{
  render(<CombinedInvoiceOrders orders={[{id:"order",order_number:12,order_date:"2026-10-12",total:50}]} isAdmin={false}/>);expect(screen.getByRole("link",{name:"INV-12"})).toHaveAttribute("href","/branch/invoices/order");
});
