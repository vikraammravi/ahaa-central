import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Stock from "@/app/admin/stock/page";
import { item, catalogFilterItems } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";

it("daily stock saves only changed quantities with expected values",async()=>{
  db.from.mockReturnValue(queryResult([item]));render(<Stock/>);const input=await screen.findByRole("spinbutton");expect(screen.getByRole("button",{name:"Save & Broadcast"})).toBeDisabled();await userEvent.clear(input);await userEvent.type(input,"15");await userEvent.click(screen.getByRole("button",{name:"Save & Broadcast"}));await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:15,expected_stock:20,expected_updated_at:item.updated_at}]}));
});

it("stock filters names and categories without losing hidden quantity edits",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems));render(<Stock/>);
  const inputs=await screen.findAllByRole("spinbutton");await userEvent.clear(inputs[0]);await userEvent.type(inputs[0],"15");
  expect(screen.getByRole("columnheader",{name:"Category"})).toBeVisible();expect(screen.getByRole("columnheader",{name:"Unit"})).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search products"),"paper");expect(screen.queryByText(item.name)).not.toBeInTheDocument();expect(screen.getByText("Paper Bag")).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Packaging");
  await userEvent.click(screen.getByRole("button",{name:"Save & Broadcast"}));
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("save_daily_stock",{p_updates:[{id:item.id,available_stock:15,expected_stock:20,expected_updated_at:item.updated_at}]}));
});
