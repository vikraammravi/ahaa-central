import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceTotals } from "@/components/shared/InvoiceTotals";

it.each([[0,"Tax (N/A)"],[13,"Tax (13%)"]])("invoice totals use correct tax labels for %s",(tax,label)=>{
    render(<InvoiceTotals subtotal={100} tax={tax as number} total={100+Number(tax)}/>);expect(screen.getByText(label)).toBeVisible();expect(screen.getByText("Total").parentElement).toHaveTextContent(`CA$${(100+Number(tax)).toFixed(2)}`);
  });
