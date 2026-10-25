import {expect,it} from "vitest";
import {render,screen} from "@testing-library/react";
import {InvoiceActions} from "./InvoiceActions";
it("opens PDFs in a new tab and retains the separate admin edit action",()=>{
  render(<InvoiceActions id="order" kind="individual" edit/>);
  expect(screen.getByRole("link",{name:"Edit invoice"})).toHaveAttribute("href","/admin/invoices/order");
  const pdf=screen.getByRole("link",{name:"View PDF"});expect(pdf).toHaveAttribute("href","/api/invoices/individual/order/pdf");expect(pdf).toHaveAttribute("target","_blank");expect(pdf).toHaveAttribute("rel","noopener noreferrer");
});
