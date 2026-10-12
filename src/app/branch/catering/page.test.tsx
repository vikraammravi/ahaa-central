import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catering from "@/app/branch/catering/page";
import { db, queryResult } from "@tests/mocks/supabase";

it("catering status filter reaches the server query",async()=>{
  const query=queryResult([],null,0);db.from.mockReturnValue(query);render(<Catering/>);await screen.findByText("No matching catering events");await userEvent.selectOptions(screen.getByLabelText("Status"),"CONFIRMED");await waitFor(()=>expect(query.eq).toHaveBeenCalledWith("status","CONFIRMED"));
});
