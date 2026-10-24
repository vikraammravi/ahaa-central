import { expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catering from "./page";
import { db, queryResult } from "@tests/mocks/supabase";
import { cateringEvent, centralLocation } from "@tests/mocks/fixtures";

it("admin catering is scoped to central kitchen and creates bookings there",async()=>{
  const locations=queryResult([centralLocation]);
  const events=queryResult([],null,0);
  db.from.mockImplementation(table=>table==="locations"?locations:events);
  render(<Catering/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Add Event"})).toBeEnabled());
  expect(locations.eq).toHaveBeenCalledWith("is_central",true);
  await waitFor(()=>expect(events.eq).toHaveBeenCalledWith("location_id",centralLocation.id));
  await userEvent.click(screen.getByRole("button",{name:"Add Event"}));
  const dialog=within(screen.getByRole("dialog"));
  await userEvent.type(dialog.getByLabelText(/Customer Name/),cateringEvent.customer_name);
  await userEvent.type(dialog.getByLabelText(/Customer Phone/),cateringEvent.customer_phone);
  fireEvent.change(dialog.getByLabelText(/Event Date/),{target:{value:"2026-11-01"}});
  await userEvent.type(dialog.getByLabelText(/Guest Count/),String(cateringEvent.guest_count));
  await userEvent.type(dialog.getByLabelText(/Total \(CA/),String(cateringEvent.total_amount));
  await userEvent.click(dialog.getByRole("button",{name:"Create Event"}));
  await waitFor(()=>expect(events.insert).toHaveBeenCalledWith(expect.objectContaining({location_id:centralLocation.id,customer_name:cateringEvent.customer_name,total_amount:cateringEvent.total_amount})));
});

it("admin cannot create an unscoped event if central location is missing",async()=>{
  const locations=queryResult([]);db.from.mockReturnValue(locations);
  render(<Catering/>);
  expect(await screen.findByText(/Set up one central-kitchen location/)).toBeVisible();
  expect(screen.getByRole("button",{name:"Add Event"})).toBeDisabled();
  expect(db.from).not.toHaveBeenCalledWith("catering_events");
});
