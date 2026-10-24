import { expect,it } from "vitest";
import { fireEvent,render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmployeeCateringPage from "./page";
import { db,queryResult } from "@tests/mocks/supabase";
import { profile,cateringEvent } from "@tests/mocks/fixtures";

it("employees use the same catering screen and are scoped to their assigned branch",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  const query=queryResult([]);
  db.from.mockImplementation(table=>table==="profiles"?queryResult({...profile,role:"BRANCH_EMPLOYEE"}):query);
  render(<EmployeeCateringPage/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Add Event"})).toBeEnabled());
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("location_id",profile.location_id));
  expect(screen.getByLabelText("Status")).toHaveValue("CONFIRMED");
  expect(screen.getByLabelText("Event Date")).toBeVisible();
});

it("a saved employee booking becomes visible even when the page was filtered to Confirmed",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  let saved:unknown[]=[];
  db.from.mockImplementation(table=>{
    if(table==="profiles")return queryResult({...profile,role:"BRANCH_EMPLOYEE"});
    const query=queryResult(saved,null,saved.length);
    query.insert.mockImplementation(input=>{saved=[{...cateringEvent,...input,event_datetime:"2020-11-01T18:00:00Z"}];return queryResult(null);});
    return query;
  });
  render(<EmployeeCateringPage/>);await waitFor(()=>expect(screen.getByRole("button",{name:"Add Event"})).toBeEnabled());
  await userEvent.click(screen.getByRole("button",{name:"Add Event"}));const dialog=within(screen.getByRole("dialog"));
  await userEvent.type(dialog.getByLabelText(/Customer Name/),cateringEvent.customer_name);
  await userEvent.type(dialog.getByLabelText(/Customer Phone/),cateringEvent.customer_phone);
  fireEvent.change(dialog.getByLabelText(/Event Date/),{target:{value:"2020-11-01"}});
  await userEvent.type(dialog.getByLabelText(/Guest Count/),"20");await userEvent.type(dialog.getByLabelText(/Total \(CA/),"100");
  await userEvent.click(dialog.getByRole("button",{name:"Create Event"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Status")).toHaveValue("INQUIRY");expect(screen.getByLabelText("Event Date")).toHaveValue("2020-11-01");
  expect(await screen.findByText(cateringEvent.customer_name)).toBeVisible();expect(screen.getByText(/Booking saved. Showing Inquiry/)).toBeVisible();
});
