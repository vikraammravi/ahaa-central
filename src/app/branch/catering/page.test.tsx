import { expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catering from "@/app/branch/catering/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { profile } from "@tests/mocks/fixtures";

it("catering status filter reaches the server query",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  const query=queryResult([],null,0);db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):query);render(<Catering/>);await screen.findByText("No matching catering events");await userEvent.selectOptions(screen.getByLabelText("Status"),"CONFIRMED");await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("status","CONFIRMED"));expect(query.eq).toHaveBeenCalledWith("location_id",profile.location_id);
});

it("one event date filters the whole Toronto day",async()=>{
  db.auth.getUser.mockResolvedValue({data:{user:{id:profile.id}},error:null});
  const query=queryResult([],null,0);db.from.mockImplementation(table=>table==="profiles"?queryResult(profile):query);
  render(<Catering/>);await screen.findByText("No matching catering events");
  expect(screen.queryByLabelText("From Date")).not.toBeInTheDocument();expect(screen.queryByLabelText("To Date")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Event Date"),{target:{value:"2026-11-01"}});
  await waitFor(()=>expect(query.gte).toHaveBeenCalledWith("event_datetime","2026-11-01T04:00:00.000Z"));
  expect(query.lt).toHaveBeenCalledWith("event_datetime","2026-11-02T05:00:00.000Z");
});
