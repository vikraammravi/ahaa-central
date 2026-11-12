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
  expect(pickupCells[headers.indexOf("Notes")]).toHaveTextContent("—");
  expect(within(rows[1]).queryByRole("button",{name:"View address"})).not.toBeInTheDocument();
});

it.each([390,820,1280])("shows notes and the full delivery address together at %spx",async width=>{
  mockViewport(width);
  render(<CateringTable events={[{...deliveryCateringEvent,notes:cateringNotes}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);
  expect(screen.queryByRole("button",{name:"View address"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"View Notes"}));
  const dialog=screen.getByRole("dialog",{name:`Notes — ${event.customer_name}`});
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
  expect(within(screen.getByRole("dialog")).getByText(/Unit 4, 1180 Simcoe St N/)).toBeVisible();
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
  const dialog=screen.getByRole("dialog",{name:`Notes — ${event.customer_name}`});
  expect(within(dialog).getByRole("region",{name:"Full notes"}).textContent).toBe(cateringNotes);
  expect(within(dialog).queryByText("Delivery address")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("Old address")).not.toBeInTheDocument();
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
  const dialog=screen.getByRole("dialog",{name:`Notes — ${event.customer_name}`});
  expect(within(dialog).getByRole("region",{name:"Full notes"}).textContent).toBe(cateringNotes);
});

it("catering blocks ambiguous contact links",()=>{
  render(<CateringTable events={[{...event,customer_phone:"123"}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByRole("button",{name:"No valid phone number"})).toBeDisabled();expect(screen.queryByRole("link",{name:/WhatsApp/})).not.toBeInTheDocument();
});
