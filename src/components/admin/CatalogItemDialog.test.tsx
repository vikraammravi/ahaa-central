import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogItemDialog } from "@/components/admin/CatalogItemDialog";
import { item } from "@tests/mocks/fixtures";
import { db, queryResult } from "@tests/mocks/supabase";
import { catalogOptions } from "@tests/mocks/catalog-options";

it("catalog offers new categories and saves thresholds and units",async()=>{
  const query=queryResult(null);db.from.mockReturnValue(query);const saved=vi.fn();
  render(<CatalogItemDialog options={catalogOptions} item={item} open onOpenChange={vi.fn()} onSaved={saved}/>);
  const category=screen.getByLabelText("Category");expect(within(category).getByRole("option",{name:"Diary"})).toBeInTheDocument();expect(within(category).getByRole("option",{name:"Podi"})).toBeInTheDocument();expect(within(category).queryByRole("option",{name:"Pantry"})).not.toBeInTheDocument();
  expect(within(category).getByRole("option",{name:"Desserts"})).toBeInTheDocument();expect(within(category).getByRole("option",{name:"Packaging"})).toBeInTheDocument();expect(within(category).queryByRole("option",{name:"Sweet"})).not.toBeInTheDocument();
  await userEvent.selectOptions(category,"Grocery");await userEvent.selectOptions(screen.getByLabelText("Unit"),"Packet");
  await userEvent.click(screen.getByRole("button",{name:"Save Changes"}));expect(query.update).toHaveBeenCalledWith(expect.objectContaining({category:"Grocery",unit_type:"Packet",low_stock_threshold:5}));expect(saved).toHaveBeenCalled();
});
