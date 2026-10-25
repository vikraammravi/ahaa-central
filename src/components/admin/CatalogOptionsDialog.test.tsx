import { expect,it,vi } from "vitest";
import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogOptionsDialog } from "./CatalogOptionsDialog";
import { db,queryResult } from "@tests/mocks/supabase";
import { catalogOptions,archivedCatalogOption } from "@tests/mocks/catalog-options";
import { mockViewport } from "@tests/mocks/viewport";

it.each([390,820,1280])("manages categories with accessible actions at %spx",async width=>{
  mockViewport(width);const query=queryResult(null);db.from.mockReturnValue(query);const saved=vi.fn();
  render(<CatalogOptionsDialog kind="categories" options={catalogOptions.categories} loading={false} onSaved={saved}/>);
  await userEvent.click(screen.getByRole("button",{name:"Manage Categories"}));
  await userEvent.type(screen.getByLabelText("New category"),"Frozen");
  await userEvent.click(screen.getByRole("button",{name:"Add"}));
  await waitFor(()=>expect(query.insert).toHaveBeenCalledWith({name:"Frozen"}));expect(saved).toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button",{name:"Archive Batter"}));
  await waitFor(()=>expect(query.update).toHaveBeenCalledWith({is_active:false}));
});

it.each(["categories","units"] as const)("hides archived %s and restores the original record when its name is entered",async kind=>{
  const query=queryResult(null);db.from.mockReturnValue(query);
  let options=[...catalogOptions[kind],archivedCatalogOption];
  const saved=vi.fn(async()=>{options=options.map(option=>({...option,is_active:true}));view.rerender(<CatalogOptionsDialog kind={kind} options={options} loading={false} onSaved={saved}/>);});
  const view=render(<CatalogOptionsDialog kind={kind} options={options} loading={false} onSaved={saved}/>);
  await userEvent.click(screen.getByRole("button",{name:kind==="categories"?"Manage Categories":"Manage Units"}));
  expect(screen.queryByRole("button",{name:"Restore Frozen Goods"})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("checkbox",{name:"Show archived"}));
  expect(screen.getByRole("button",{name:"Restore Frozen Goods"})).toBeVisible();
  await userEvent.click(screen.getByRole("checkbox",{name:"Show archived"}));
  await userEvent.type(screen.getByLabelText(kind==="categories"?"New category":"New unit"),"  frozen goods  ");
  expect(screen.getByRole("status")).toHaveTextContent("Restore it?");
  expect(screen.getByRole("button",{name:"Add"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Restore"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Archive Frozen Goods"})).toBeVisible());
  expect(query.update).toHaveBeenCalledWith({is_active:true});expect(query.eq).toHaveBeenCalledWith("id",archivedCatalogOption.id);
  expect(query.insert).not.toHaveBeenCalled();
});

it("keeps an unsuccessful restore available for retry",async()=>{
  db.from.mockReturnValue(queryResult(null,{message:"Unable to restore now"}));
  render(<CatalogOptionsDialog kind="units" options={[archivedCatalogOption]} loading={false} onSaved={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button",{name:"Manage Units"}));
  await userEvent.type(screen.getByLabelText("New unit"),archivedCatalogOption.name);
  await userEvent.click(screen.getByRole("button",{name:"Restore"}));
  expect(await screen.findByText("Unable to restore now")).toBeVisible();
  expect(screen.getByLabelText("New unit")).toHaveValue(archivedCatalogOption.name);
  expect(screen.getByRole("button",{name:"Restore"})).toBeEnabled();
});
it("blocks duplicate names and never offers deletion for used units",async()=>{
  render(<CatalogOptionsDialog kind="units" options={catalogOptions.units.map(option=>({...option,ever_used:true}))} loading={false} onSaved={vi.fn()}/>);
  await userEvent.click(screen.getByRole("button",{name:"Manage Units"}));
  expect(screen.queryByRole("button",{name:"Delete"})).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("New unit"),"bucket");await userEvent.click(screen.getByRole("button",{name:"Add"}));
  expect(await screen.findByText("This name already exists.")).toBeVisible();expect(db.from).not.toHaveBeenCalled();
});
