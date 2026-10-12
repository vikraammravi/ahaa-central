import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catalog from "@/app/admin/catalog/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { item } from "@tests/mocks/fixtures";

it("catalog active filter excludes inactive products",async()=>{
  db.from.mockReturnValue(queryResult([item,{...item,id:"inactive",name:"Disabled Item",is_active:false}]));render(<Catalog/>);await screen.findByText("Disabled Item");await userEvent.click(screen.getByRole("button",{name:/^Active/}));expect(screen.queryByText("Disabled Item")).not.toBeInTheDocument();expect(screen.getByText(item.name)).toBeVisible();
});
