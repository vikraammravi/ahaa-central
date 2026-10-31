import { cateringEvent as event, deliveryCateringEvent } from "@tests/mocks/fixtures";
import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CateringEventDialog } from "@/components/branch/CateringEventDialog";

import { db, queryResult } from "@tests/mocks/supabase";

it("catering edits recalculate the balance",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);render(<CateringEventDialog event={event} locationId="branch" open onOpenChange={vi.fn()}/>);const advance=screen.getByLabelText(/Advance Paid/i);await userEvent.clear(advance);await userEvent.type(advance,"40");await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));expect(query.update).toHaveBeenCalledWith(expect.objectContaining({advance_paid:40,balance_due:60}));
});

it("defaults to pickup and requires an address only for delivery",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);
  render(<CateringEventDialog event={event} locationId="branch" open onOpenChange={vi.fn()}/>);
  expect(screen.getByLabelText(/Pickup or Delivery/)).toHaveValue("PICKUP");
  expect(screen.queryByLabelText(/Delivery Address/)).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/Pickup or Delivery/),"DELIVERY");
  const address=screen.getByLabelText(/Delivery Address/);expect(address).toBeRequired();
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(query.update).not.toHaveBeenCalled();
  await userEvent.type(address,"  10 King St, Oshawa ON  ");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({fulfillment_method:"DELIVERY",delivery_address:"10 King St, Oshawa ON"}));
});

it("loads saved delivery details and clears the stored address when changed to pickup",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);
  render(<CateringEventDialog event={deliveryCateringEvent} locationId="branch" open onOpenChange={vi.fn()}/>);
  expect(screen.getByLabelText(/Delivery Address/)).toHaveValue(deliveryCateringEvent.delivery_address);
  await userEvent.selectOptions(screen.getByLabelText(/Pickup or Delivery/),"PICKUP");
  expect(screen.queryByLabelText(/Delivery Address/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({fulfillment_method:"PICKUP",delivery_address:null}));
});

it("creates a delivery booking and resets the next booking to pickup",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);
  render(<CateringEventDialog locationId="branch" open onOpenChange={vi.fn()}/>);
  await userEvent.type(screen.getByLabelText(/Customer Name/),deliveryCateringEvent.customer_name);
  await userEvent.type(screen.getByLabelText(/Customer Phone/),deliveryCateringEvent.customer_phone);
  await userEvent.type(screen.getByLabelText(/Guest Count/),"20");
  await userEvent.type(screen.getByLabelText(/Event Date/),"2026-11-05");
  await userEvent.type(screen.getByLabelText(/Total \(CA\$/),"100");
  await userEvent.selectOptions(screen.getByLabelText(/Pickup or Delivery/),"DELIVERY");
  await userEvent.type(screen.getByLabelText(/Delivery Address/),deliveryCateringEvent.delivery_address!);
  await userEvent.click(screen.getByRole("button",{name:"Create Event"}));
  expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({location_id:"branch",fulfillment_method:"DELIVERY",delivery_address:deliveryCateringEvent.delivery_address}));
  expect(screen.getByLabelText(/Pickup or Delivery/)).toHaveValue("PICKUP");
});
