import { combinedInvoice as details } from "@tests/mocks/fixtures";
import { expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyInvoiceList } from "@/features/billing/components/WeeklyInvoiceList";

import { order, branch } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";
import { mockViewport } from "@tests/mocks/viewport";

it("combined invoice expands without making a separate details request",async()=>{
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"UNPAID",payment_revision:null,locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:/Show orders/}));expect(screen.getByText("INV-12")).toBeVisible();expect(screen.getAllByText("Individual invoices (1)").length).toBeGreaterThan(0);expect(db.rpc).not.toHaveBeenCalled();
});

it("places expanded individual invoice values under the matching desktop columns",async()=>{
  mockViewport(1440);
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"UNPAID",payment_revision:null,locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:/Show orders/}));
  const table=screen.getByRole("table");
  const rows=within(table).getAllByRole("row");
  const summary=rows.find(row=>within(row).queryByText("WK-COMBINED"))!;
  const individual=rows.find(row=>within(row).queryByText("INV-12"))!;
  const summaryCells=within(summary).getAllByRole("cell");
  const cells=within(individual).getAllByRole("cell");
  expect(cells).toHaveLength(summaryCells.length);
  expect(cells[1]).toHaveTextContent("INV-12");
  expect(cells[3]).toHaveTextContent("Order date");
  expect(cells[6]).toHaveTextContent("CA$50.00");
  expect(within(cells[9]).getByRole("link",{name:"Edit invoice"})).toBeVisible();
  expect(within(table).queryAllByRole("table")).toHaveLength(0);
});

it("retains individual invoice cards when expanded on mobile",async()=>{
  mockViewport(390);
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"UNPAID",payment_revision:null,locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  expect(await screen.findByRole("button",{name:"Show orders for WK-COMBINED"})).toBeVisible();
  expect(screen.queryByRole("button",{name:"Edit WK-COMBINED"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Show orders for WK-COMBINED"}));
  expect(screen.getByText("Individual invoices (1)")).toBeVisible();
  expect(screen.getByText("INV-12")).toBeVisible();
  expect(screen.getByRole("link",{name:"Edit invoice"})).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("branch combined list uses published amounts and has no send button",async()=>{
  db.from.mockReturnValue(queryResult([{...details,locations:branch,revision:1,sent_revision:0,payment_status:"UNPAID",orders:[{...order,final_total_amount:99}],weekly_invoice_publications:[{revision:0,snapshot:details}]}],null,1));render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="sent" isAdmin={false}/>);expect(await screen.findByText("CA$50.00")).toBeVisible();expect(screen.queryByText("CA$99.00")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:/^Send/})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:/Update payment/})).not.toBeInTheDocument();
});

it("lets admin review order edits and undo an unsent combination",async()=>{
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"UNPAID",locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  db.rpc.mockReturnValue(queryResult(null));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  expect(await screen.findByRole("button",{name:"Show orders for WK-COMBINED"})).toBeVisible();
  expect(screen.queryByRole("button",{name:"Edit WK-COMBINED"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Show orders for WK-COMBINED"}));
  expect(screen.getByRole("link",{name:"Edit invoice"})).toHaveAttribute("href",`/admin/invoices/${order.id}`);
  await userEvent.click(screen.getByRole("button",{name:"Undo WK-COMBINED"}));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Undo combination"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("undo_combined_invoice",{p_invoice_id:"combined"}));
});

it("hides edit and undo for sent combinations",async()=>{
  const state={sent_at:"2026-10-12T12:00:00Z",payment_status:"UNPAID"};
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:0,needs_sending:false,...state,locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:/Show orders/}));
  expect(screen.queryByRole("button",{name:"Edit WK-COMBINED"})).not.toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Undo WK-COMBINED"})).not.toBeInTheDocument();
  expect(screen.queryByRole("link",{name:"Edit invoice"})).not.toBeInTheDocument();
});

it("allows editing an unsent paid invoice while protecting its payment from undo",async()=>{
  db.from.mockReturnValue(queryResult([{id:"combined",start_date:"2026-10-01",end_date:"2026-10-12",revision:0,sent_revision:null,sent_at:null,needs_sending:true,payment_status:"PAID",locations:{name:"Oshawa"},orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:"Show orders for WK-COMBINED"}));
  expect(screen.getByRole("link",{name:"Edit invoice"})).toBeVisible();
  expect(screen.queryByRole("button",{name:"Undo WK-COMBINED"})).not.toBeInTheDocument();
});

it("asks before sending and does not send when cancelled", async () => {
  db.from.mockReturnValue(queryResult([{...details,id:"combined",sent_revision:null,needs_sending:true,payment_status:"UNPAID",payment_updated_at:null,payment_revision:null,locations:branch,orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  const send = await screen.findByRole("button",{name:"Send WK-COMBINED"});
  expect(screen.queryByRole("link",{name:"Details"})).not.toBeInTheDocument();
  await userEvent.click(send);
  expect(screen.getByRole("dialog",{name:"Send invoice?"})).toBeVisible();
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Cancel"}));
  expect(db.rpc).not.toHaveBeenCalled();
  await userEvent.click(send);
  db.rpc.mockReturnValue(queryResult(null));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Send invoice"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("send_weekly_invoice",{p_invoice_id:"combined"}));
});

it("shows a disabled sent icon for sent invoices", async () => {
  db.from.mockReturnValue(queryResult([{...details,id:"combined",sent_at:"2026-10-12T12:00:00Z",sent_revision:0,needs_sending:false,payment_status:"UNPAID",locations:branch,orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  expect(await screen.findByRole("button",{name:"WK-COMBINED sent"})).toBeDisabled();
  expect(screen.getByText("Sent")).toBeVisible();
});

it("keeps payment status editable from the invoice list", async () => {
  db.from.mockReturnValue(queryResult([{...details,id:"combined",sent_revision:null,needs_sending:true,payment_status:"UNPAID",payment_updated_at:null,payment_revision:null,locations:branch,orders:[{...order,final_total_amount:50}]}],null,1));
  db.rpc.mockReturnValue(queryResult(null));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  const paymentButton = await screen.findByRole("button",{name:"Update payment for WK-COMBINED"});
  expect(paymentButton).toHaveAttribute("title","Update payment status");
  expect(screen.getByText("Unpaid")).toBeVisible();
  expect(paymentButton).not.toHaveTextContent("Unpaid");
  expect(paymentButton.parentElement).toContainElement(screen.getByText("Unpaid"));
  const headers=screen.getAllByRole("columnheader").map(header=>header.textContent);
  expect(headers.slice(-3)).toEqual(["Status","Payment","Actions"]);
  await userEvent.click(paymentButton);
  expect(screen.getByRole("button",{name:"Show orders for WK-COMBINED",hidden:true})).toHaveAttribute("aria-expanded","false");
  const dialog = screen.getByRole("dialog",{name:"Payment for WK-COMBINED"});
  await userEvent.click(within(dialog).getByRole("button",{name:"Mark Paid"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("set_invoice_payment_status",{p_invoice_id:"combined",p_status:"PAID",p_expected_updated_at:null}));
});

it.each([390,768,1024,1280,1439])("keeps payment and invoice actions available in compact layout at %i px", async width => {
  mockViewport(width);
  db.from.mockReturnValue(queryResult([{...details,id:"combined",sent_revision:null,needs_sending:true,payment_status:"UNPAID",payment_updated_at:null,payment_revision:null,locations:branch,orders:[{...order,final_total_amount:50}]}],null,1));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  const paymentButton = await screen.findByRole("button",{name:"Update payment for WK-COMBINED"});
  expect(paymentButton).toHaveAttribute("title","Update payment status");
  expect(paymentButton.parentElement).toContainElement(screen.getByText("Unpaid"));
  expect(screen.getByRole("button",{name:"Send WK-COMBINED"})).toBeEnabled();
  expect(screen.getByRole("link",{name:"View PDF"})).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(paymentButton);
  expect(screen.getByRole("dialog",{name:"Payment for WK-COMBINED"})).toBeVisible();
});

it("shows the send error when publishing fails", async () => {
  db.from.mockReturnValue(queryResult([{...details,id:"combined",sent_revision:null,needs_sending:true,payment_status:"UNPAID",locations:branch,orders:[{...order,final_total_amount:50}]}],null,1));
  db.rpc.mockReturnValue(queryResult(null,{message:"Unable to publish"}));
  render(<WeeklyInvoiceList filters={{branchId:"",startDate:"",endDate:""}} mode="all"/>);
  await userEvent.click(await screen.findByRole("button",{name:"Send WK-COMBINED"}));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Send invoice"}));
  expect(await screen.findByText("Unable to publish")).toBeVisible();
});
