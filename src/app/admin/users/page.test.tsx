import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Users from "@/app/admin/users/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { branch, profile } from "@tests/mocks/fixtures";

it("users pagination requests the next database range",async()=>{
  const usersQuery=queryResult([profile],null,26);db.from.mockImplementation(table=>table==="locations"?queryResult([branch]):usersQuery);render(<Users/>);await screen.findByText(profile.email!);await userEvent.click(screen.getByRole("button",{name:"Next"}));await waitFor(()=>expect(usersQuery.range).toHaveBeenCalledWith(25,49));
});
