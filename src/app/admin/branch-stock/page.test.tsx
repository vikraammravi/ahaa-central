import {expect,it} from "vitest";
import {render,screen,within,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchStock from "./page";
import {db,queryResult} from "@tests/mocks/supabase";
import {branch} from "@tests/mocks/fixtures";
import {branchStockOverview} from "@tests/mocks/branch-stock";
import {mockViewport} from "@tests/mocks/viewport";
function setup(){db.from.mockReturnValue(queryResult([branch,{...branch,id:"second",name:"Whitby"}]));db.rpc.mockReturnValue(queryResult(branchStockOverview));}
it("shows central and individual branch quantities without statuses or editing",async()=>{
  setup();render(<BranchStock/>);await screen.findByText("Idli Batter");
  const headers=screen.getAllByRole("columnheader").map(header=>header.textContent);
  expect(headers).toEqual(["Item Name","Central Stock","Oshawa","Whitby"]);
  const cells=within(screen.getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells.slice(1).map(cell=>cell.textContent)).toEqual(["20","3","0"]);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Edit"})).not.toBeInTheDocument();
});
it.each([390,820])("shows read-only item cards at %spx",async width=>{
  mockViewport(width);setup();render(<BranchStock/>);await screen.findByText("Idli Batter");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();expect(screen.getByText("Central Stock")).toBeVisible();expect(screen.getByText("Whitby")).toBeVisible();expect(screen.getByText("0")).toBeVisible();
});
it("filters on the server by product, category and branch",async()=>{
  setup();render(<BranchStock/>);await screen.findByText("Idli Batter");
  await userEvent.type(screen.getByLabelText("Search products"),"Idli");
  await userEvent.selectOptions(screen.getByLabelText("Category"),"Batter");
  await userEvent.selectOptions(screen.getByLabelText("Branch"),branch.id);
  await waitFor(()=>expect(db.rpc).toHaveBeenCalledWith("admin_branch_stock",{p_page:0,p_search:"Idli",p_category:"Batter",p_branch_id:branch.id}));
});
it("reports unavailable stock instead of silently showing zero",async()=>{
  setup();db.rpc.mockReturnValue(queryResult(null,{message:"Stock unavailable"}));render(<BranchStock/>);
  expect(await screen.findByText("Stock unavailable")).toBeVisible();
});
