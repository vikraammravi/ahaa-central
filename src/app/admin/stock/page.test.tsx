import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stock from "@/app/admin/stock/page";
import { item } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("daily stock saves only changed quantities with expected values",async()=>{
  db.from.mockReturnValue(queryResult([item]));render(<Stock/>);const input=await screen.findByRole("spinbutton");expect(screen.getByRole("button",{name:"Save & Broadcast"})).toBeDisabled();await userEvent.clear(input);await userEvent.type(input,"15");await userEvent.click(screen.getByRole("button",{name:"Save & Broadcast"}));await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:15,expected_stock:20,expected_updated_at:item.updated_at}]}));
});
