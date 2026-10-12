import { combinedInvoice as details } from "@tests/mocks/fixtures";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyInvoiceList } from "@/components/shared/WeeklyInvoiceList";

import { order, branch } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("combined invoice expands without making a separate details request",async()=>{
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"UNPAID",payment_revision:null,locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:/Show orders/}));expect(screen.getByText("INV-12")).toBeVisible();expect(screen.getByText("Individual invoices (1)")).toBeVisible();expect(db.rpc).not.toHaveBeenCalled();
});

it("branch combined list uses published amounts and has no send button",async()=>{
  db.from.mockReturnValue(queryResult([{...details,locations:branch,revision:1,sent_revision:0,payment_status:"UNPAID",orders:[{...order,final_total_amount:99}],weekly_invoice_publications:[{revision:0,snapshot:details}]}],null,1));render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="sent" isAdmin={false}/>);expect(await screen.findByText("CA$50.00")).toBeVisible();expect(screen.queryByText("CA$99.00")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Send"})).not.toBeInTheDocument();
});
