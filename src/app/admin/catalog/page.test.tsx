import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catalog from "@/app/admin/catalog/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { item, catalogFilterItems } from "@tests/mocks/fixtures";

it("catalog active filter excludes inactive products",async()=>{
  db.from.mockReturnValue(queryResult([item,{...item,id:"inactive",name:"Disabled Item",is_active:false}]));render(<Catalog/>);await screen.findByText("Disabled Item");await userEvent.selectOptions(screen.getByLabelText("Status"),"active");expect(screen.queryByText("Disabled Item")).not.toBeInTheDocument();expect(screen.getByText(item.name)).toBeVisible();await userEvent.selectOptions(screen.getByLabelText("Status"),"inactive");expect(screen.getByText("Disabled Item")).toBeVisible();expect(screen.queryByText(item.name)).not.toBeInTheDocument();await userEvent.selectOptions(screen.getByLabelText("Status"),"all");expect(screen.getByText(item.name)).toBeVisible();expect(screen.queryByRole("button",{name:/^Active/})).not.toBeInTheDocument();
});

it("catalog combines category and product-name filters",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems));render(<Catalog/>);await screen.findByText("Milk Sweet");
  expect(screen.getByRole("columnheader",{name:"Unit"})).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Desserts");expect(screen.queryByText(item.name)).not.toBeInTheDocument();expect(screen.getByText("Milk Sweet")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search products"),"batter");expect(screen.getByText("No items in this view")).toBeVisible();
});
