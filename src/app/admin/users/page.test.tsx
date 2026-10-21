import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Users from "@/app/admin/users/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, profile } from "@tests/mocks/fixtures";

it("users pagination requests the next database range",async()=>{
  const usersQuery=queryResult([profile],null,26);db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):usersQuery);render(<Users/>);await screen.findByText(profile.email!);await userEvent.click(screen.getByRole("button",{name:"Next"}));await waitFor(()=>expect(usersQuery.range).toHaveBeenCalledWith(25,49));
});

it("branch and status filters apply before paging and reset to the first page",async()=>{
  const query=queryResult([profile],null,26);
  db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):query);
  render(<Users/>);await screen.findByText(profile.email!);
  await userEvent.click(screen.getByRole("button",{name:"Next"}));
  await waitFor(()=>expect(query.range).toHaveBeenLastCalledWith(25,49));
  await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("location_id",branch.id));
  expect(query.range).toHaveBeenLastCalledWith(0,24);
  await userEvent.selectOptions(screen.getByLabelText("Status"),"disabled");
  await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("status","disabled"));
  query.eq.mockClear();
  await userEvent.selectOptions(screen.getByLabelText("Branch"),"");
  await userEvent.selectOptions(screen.getByLabelText("Status"),"");
  await waitFor(()=>expect(query.range).toHaveBeenLastCalledWith(0,24));
  expect(query.eq.mock.calls.some(([column,value])=>column==="location_id"&&value===branch.id)).toBe(false);
});
