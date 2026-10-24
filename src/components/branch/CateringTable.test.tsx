import { cateringEvent as event, cateringNotes } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CateringTable } from "@/components/branch/CateringTable";
import { mockViewport } from "@tests/mocks/viewport";

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
