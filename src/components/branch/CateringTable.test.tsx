import { cateringEvent as event } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CateringTable } from "@/components/branch/CateringTable";

it("catering exposes correct call and Canadian WhatsApp links",()=>{
  render(<CateringTable events={[event]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByRole("link",{name:"Call Test Customer"})).toHaveAttribute("href","tel:4165550100");expect(screen.getByRole("link",{name:"WhatsApp Test Customer"})).toHaveAttribute("href","https://wa.me/14165550100");
});

it("catering blocks ambiguous contact links",()=>{
  render(<CateringTable events={[{...event,customer_phone:"123"}]} loading={false} onEdit={vi.fn()} onDelete={vi.fn()}/>);expect(screen.getByRole("button",{name:"No valid phone number"})).toBeDisabled();expect(screen.queryByRole("link",{name:/WhatsApp/})).not.toBeInTheDocument();
});
