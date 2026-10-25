import { installCatalogRpc } from "@tests/mocks/catalog";
import { expect, it } from "vitest";
import { render, screen, waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Catalog from "@/app/admin/catalog/page";
import { db, queryResult } from "@tests/mocks/supabase";
import { item, catalogFilterItems,categorySortedCatalogItems } from "@tests/mocks/fixtures";
import { mockViewport } from "@tests/mocks/viewport";

it("shows categories alphabetically and items alphabetically within each category",async()=>{
  db.from.mockReturnValue(queryResult(categorySortedCatalogItems));installCatalogRpc();render(<Catalog/>);
  await screen.findByText("Apple Box");
  expect(screen.getAllByRole("row").slice(1).map(row=>within(row).getAllByRole("cell")[0].textContent)).toEqual(["Alpha Batter","Zebra Batter","Apple Box"]);
});

it("catalog removal requires confirmation and reports archived history",async()=>{
  let products=[item];db.from.mockImplementation(()=>queryResult(products));
  db.rpc.mockImplementation(name=>{if(name==="remove_catalog_item"){products=[];return queryResult("archived");}return queryResult(null);});
  installCatalogRpc();render(<Catalog/>);await screen.findByText(item.name);
  await userEvent.click(screen.getByRole("button",{name:"Delete"}));
  const dialog=within(screen.getByRole("dialog",{name:`Remove ${item.name}?`}));
  expect(dialog.getByText(/history preserved/)).toBeVisible();
  expect(db.rpc).not.toHaveBeenCalledWith("remove_catalog_item",expect.anything());
  await userEvent.click(dialog.getByRole("button",{name:"Delete"}));
  expect(await screen.findByText(`${item.name} archived. Past orders and inventory records are preserved.`)).toBeVisible();
  expect(db.rpc).toHaveBeenCalledWith("remove_catalog_item",{p_item_id:item.id});
});

it.each([390,820])("compact catalog cards keep direct actions and filter state at %spx",async width=>{
  mockViewport(width);db.from.mockReturnValue(queryResult(catalogFilterItems));installCatalogRpc();render(<Catalog/>);await screen.findByText(item.name);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button",{name:"Edit"})).toHaveLength(3);
  expect(screen.getAllByRole("button",{name:"Deactivate"})).toHaveLength(3);
  await userEvent.click(screen.getByRole("button",{name:"Search & filters"}));
  await userEvent.type(screen.getByLabelText("Search products"),"batter");
  await userEvent.click(screen.getByRole("button",{name:"Show results"}));
  await waitFor(()=>expect(screen.queryByText("Paper Bag")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button",{name:"Search & filters"}));
  expect(screen.getByLabelText("Search products")).toHaveValue("batter");
});

it("catalog active filter excludes inactive products",async()=>{
  db.from.mockReturnValue(queryResult([item,{...item,id:"inactive",name:"Disabled Item",is_active:false}]));installCatalogRpc();render(<Catalog/>);await screen.findByText("Disabled Item");await userEvent.selectOptions(screen.getByLabelText("Status"),"active");expect(screen.queryByText("Disabled Item")).not.toBeInTheDocument();expect(screen.getByText(item.name)).toBeVisible();await userEvent.selectOptions(screen.getByLabelText("Status"),"inactive");expect(screen.getByText("Disabled Item")).toBeVisible();expect(screen.queryByText(item.name)).not.toBeInTheDocument();await userEvent.selectOptions(screen.getByLabelText("Status"),"all");expect(screen.getByText(item.name)).toBeVisible();expect(screen.queryByRole("button",{name:/^Active/})).not.toBeInTheDocument();
});

it("catalog combines category and product-name filters",async()=>{
  db.from.mockReturnValue(queryResult(catalogFilterItems));installCatalogRpc();render(<Catalog/>);await screen.findByText("Milk Sweet");
  expect(screen.getByRole("columnheader",{name:"Unit"})).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Desserts");expect(screen.queryByText(item.name)).not.toBeInTheDocument();expect(screen.getByText("Milk Sweet")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Search products"),"batter");expect(await screen.findByText("No items in this view")).toBeVisible();
});
