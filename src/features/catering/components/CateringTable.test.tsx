import { cateringEvent as event, cateringNotes, deliveryCateringEvent, centralLocation, profile } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CateringTable } from "@/features/catering/components/CateringTable";
import { mockViewport } from "@tests/mocks/viewport";
import AdminCateringPage from "@/app/admin/catering/page";
import BranchCateringPage from "@/app/branch/catering/page";
import EmployeeCateringPage from "@/app/employee/catering/page";
import { db, queryResult } from "@tests/mocks/supabase";

it("shows delivery address in notes, without a separate address column",async()=>{
  mockViewport(1280);
  render(<CateringTable events={[deliveryCateringEvent,event]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  const headers=screen.getAllByRole("columnheader").map(header=>header.textContent);
  expect(headers).not.toContain("Address");
  const rows=screen.getAllByRole("row").slice(1);
  const deliveryCells=within(rows[0]).getAllByRole("cell");
  const methodCell=deliveryCells[headers.indexOf("Pickup / Delivery")];
  expect(methodCell).toHaveTextContent(/^Delivery$/);
  expect(within(methodCell).queryByRole("button",{name:"View address"})).not.toBeInTheDocument();
  await userEvent.click(within(deliveryCells[headers.indexOf("Notes")]).getByRole("button",{name:"View Notes"}));
  expect(within(screen.getByRole("dialog")).getByText("Delivery address")).toBeVisible();
  expect(within(screen.getByRole("dialog")).getByText(/Unit 4, 1180 Simcoe St N/)).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Close"}));
  const pickupCells=within(rows[1]).getAllByRole("cell");
  expect(pickupCells[headers.indexOf("Pickup / Delivery")]).toHaveTextContent(/^Pickup$/);
  await userEvent.click(within(pickupCells[headers.indexOf("Notes")]).getByRole("button",{name:"View Notes"}));
  const pickupDialog=screen.getByRole("dialog");
  expect(within(pickupDialog).getByText(/Pickup/)).toBeVisible();
  expect(within(pickupDialog).queryByText("Delivery address")).not.toBeInTheDocument();
  expect(within(pickupDialog).queryByRole("region",{name:"Full notes"})).not.toBeInTheDocument();
  expect(within(rows[1]).queryByRole("button",{name:"View address"})).not.toBeInTheDocument();
});

it.each([390,820,1280])("shows notes and the full delivery address together at %spx",async width=>{
  mockViewport(width);
  render(<CateringTable events={[{...deliveryCateringEvent,notes:cateringNotes}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  expect(screen.queryByRole("button",{name:"View address"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog",{name:"Notes"});
  expect(within(dialog).getByText(/4165550100/).closest("p")).toHaveTextContent("Test Customer : 4165550100");
  expect(within(dialog).getByText("CA$80.00 pending")).toBeVisible();
  expect(within(dialog).getByText(/Oct 12, 2026.*2:00 PM.*Delivery/)).toBeVisible();
  expect(within(dialog).getByRole("region",{name:"Full notes"})).toHaveTextContent(cateringNotes.replace(/\s+/g," "));
  expect(within(dialog).getByText(/Unit 4, 1180 Simcoe St N/)).toBeVisible();
});

it.each([
  {role:"CENTRAL_ADMIN",Page:AdminCateringPage},
  {role:"BRANCH_MANAGER",Page:BranchCateringPage},
  {role:"BRANCH_EMPLOYEE",Page:EmployeeCateringPage},
] as const)("shows delivery details inside notes through the $role page",async({role,Page})=>{
  mockViewport(1280);
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  db.from.mockImplementation(table=>{
    if(table==="profiles")return queryResult({...profile,role});
    if(table==="locations")return queryResult([centralLocation]);
    return queryResult([deliveryCateringEvent],null,1);
  });
  render(<Page/>);
  await userEvent.click(await screen.findByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog");
  expect(within(dialog).getByText(/Unit 4, 1180 Simcoe St N/)).toBeVisible();
  expect(within(dialog).getByText(/4165550100/).closest("p")).toHaveTextContent("Test Customer : 4165550100");
  expect(within(dialog).getByText("CA$80.00 pending")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"Close"}));
  expect(screen.getByRole("button",{name:"Edit"})).toBeEnabled();
});

it("tablet catering cards preserve notes, contacts and edit actions",async()=>{
  mockViewport(820);const onEdit=vi.fn();
  render(<CateringTable events={[{...event,notes:cateringNotes}]} loading={false} onEdit={onEdit} onDelete={vi.fn()}/>);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Advance")).toBeVisible();
  expect(screen.getByRole("link",{name:"WhatsApp Test Customer"})).toHaveAttribute("href","https://wa.me/14165550100");
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  expect(screen.getByRole("region",{name:"Full notes"}).textContent).toBe(cateringNotes);
  await userEvent.click(screen.getByRole("button",{name:"Close"}));
  await userEvent.click(screen.getByRole("button",{name:"Edit"}));
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({id:event.id}));
});

it("does not show an address for a pickup booking even when it has notes",async()=>{
  render(<CateringTable events={[{...event,notes:cateringNotes,delivery_address:"Old address"}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog",{name:"Notes"});
  expect(within(dialog).getByRole("region",{name:"Full notes"}).textContent).toBe(cateringNotes);
  expect(within(dialog).queryByText("Delivery address")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Old address")).not.toBeInTheDocument();
});

it("shows a zero balance without marking the booking as pending",async()=>{
  render(<CateringTable events={[{...event,balance_due:0}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog");
  expect(within(dialog).getByText("CA$0.00 balance")).toBeVisible();
  expect(within(dialog).queryByText(/pending/i)).not.toBeInTheDocument();
});

it("catering exposes correct call and Canadian WhatsApp links",()=>{
  render(<CateringTable events={[event]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByRole("link",{name:"Call Test Customer"})).toHaveAttribute("href","tel:4165550100");expect(screen.getByRole("link",{name:"WhatsApp Test Customer"})).toHaveAttribute("href","https://wa.me/14165550100");
});

it("keeps View Notes in its own column, hides the phone text and preserves full note order",async()=>{
  render(<CateringTable events={[{...event,notes:cateringNotes}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  expect(screen.queryByText(event.customer_phone)).not.toBeInTheDocument();
  const headers=screen.getAllByRole("columnheader").map(header=>header.textContent);
  const cells=screen.getAllByRole("row")[1].querySelectorAll("td");
  expect(within(cells[headers.indexOf("Notes")]).getByRole("button",{name:"View Notes"})).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog",{name:"Notes"});
  expect(within(dialog).getByRole("region",{name:"Full notes"}).textContent).toBe(cateringNotes);
});

it("catering blocks ambiguous contact links",()=>{
  render(<CateringTable events={[{...event,customer_phone:"123"}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByRole("button",{name:"No valid phone number"})).toBeDisabled();expect(screen.queryByRole("link",{name:/WhatsApp/})).not.toBeInTheDocument();
});

it.each([390,820,1280])("copies all delivery booking details at %spx",async width=>{
  mockViewport(width);
  const user=userEvent.setup();
  const write=vi.spyOn(navigator.clipboard,"writeText").mockResolvedValue();
  render(<CateringTable events={[{...deliveryCateringEvent,notes:cateringNotes}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  await user.click(screen.getByRole("button",{name:"View Notes"}));
  await user.click(screen.getByRole("button",{name:"Copy details"}));
  expect(write).toHaveBeenCalledTimes(1);
  const text=write.mock.calls[0][0];
  expect(text).toContain("Customer: Test Customer");
  expect(text).toContain("Phone: 4165550100");
  expect(text).toContain("Oct 12, 2026");
  expect(text).toContain("Method: Delivery");
  expect(text).toContain("Unit 4, 1180 Simcoe St N");
  expect(text).toContain("CA$80.00 pending");
  expect(text).toContain(cateringNotes);
  expect(await screen.findByRole("status")).toHaveTextContent("Details copied.");
  write.mockRestore();
});

it("shares booking details only after clicking Share",async()=>{
  const user=userEvent.setup();
  const share=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,"share",{configurable:true,value:share});
  try {
    render(<CateringTable events={[{...event,notes:cateringNotes}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
    await user.click(screen.getByRole("button",{name:"View Notes"}));
    expect(share).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button",{name:"Share"}));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({text:expect.stringContaining(cateringNotes)}));
    expect(share.mock.calls[0][0].text).toContain("Method: Pickup");
    expect(share.mock.calls[0][0].text).not.toContain("Delivery address:");
  } finally { Reflect.deleteProperty(navigator,"share"); }
});

it("falls back to copying when sharing is unavailable and reports copy failures",async()=>{
  const user=userEvent.setup();
  const write=vi.spyOn(navigator.clipboard,"writeText").mockRejectedValue(new Error("Denied"));
  render(<CateringTable events={[event]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  await user.click(screen.getByRole("button",{name:"View Notes"}));
  await user.click(screen.getByRole("button",{name:"Share"}));
  expect(write).toHaveBeenCalledOnce();
  expect(await screen.findByRole("status")).toHaveTextContent("Unable to copy details");
  write.mockRestore();
});

it("copies details when native sharing is unavailable",async()=>{
  const user=userEvent.setup();
  const write=vi.spyOn(navigator.clipboard,"writeText").mockResolvedValue();
  render(<CateringTable events={[event]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  await user.click(screen.getByRole("button",{name:"View Notes"}));
  await user.click(screen.getByRole("button",{name:"Share"}));
  expect(write).toHaveBeenCalledOnce();
  expect(write.mock.calls[0][0]).toContain("Customer: Test Customer");
  expect(await screen.findByRole("status")).toHaveTextContent("Details copied.");
  write.mockRestore();
});
