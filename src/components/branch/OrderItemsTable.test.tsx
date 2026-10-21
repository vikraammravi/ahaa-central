import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrderItemsTable } from "./OrderItemsTable";
import { item, workspace } from "@tests/mocks/fixtures";

it("separates central stock, branch stock and units from the item name",()=>{
  render(<OrderItemsTable items={[item]} inventory={workspace.items} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  const table=screen.getByRole("table");
  const headers=within(table).getAllByRole("columnheader").map(header=>header.textContent);
  const cells=within(table).getAllByRole("row")[1].querySelectorAll("td");
  expect(cells[headers.indexOf("Unit")]).toHaveTextContent(item.unit_type);
  expect(cells[headers.indexOf("Central Stock")]).toHaveTextContent(String(item.available_stock));
  expect(cells[headers.indexOf("Branch Stock")]).toHaveTextContent(String(workspace.items[0].quantity??"Not counted"));
  expect(cells[0]).not.toHaveTextContent("Branch:");
});

it("distinguishes missing branch counts from zero stock",()=>{
  const {rerender}=render(<OrderItemsTable items={[item]} inventory={[]} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  expect(screen.getByText("Not counted")).toBeVisible();
  rerender(<OrderItemsTable items={[item]} inventory={[{...workspace.items[0],quantity:0}]} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  expect(screen.queryByText("Not counted")).not.toBeInTheDocument();
  const headers=screen.getAllByRole("columnheader").map(header=>header.textContent);
  expect(screen.getAllByRole("row")[1].querySelectorAll("td")[headers.indexOf("Branch Stock")]).toHaveTextContent(/^0$/);
});
