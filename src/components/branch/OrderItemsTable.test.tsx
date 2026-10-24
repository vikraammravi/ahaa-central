import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrderItemsTable } from "./OrderItemsTable";
import { item, workspace } from "@tests/mocks/fixtures";
import userEvent from "@testing-library/user-event";
import { mockViewport } from "@tests/mocks/viewport";

it("tablet cards show stock and quantities with the same limits as desktop",async()=>{
  mockViewport(900);const onQuantity=vi.fn();
  const {rerender}=render(<OrderItemsTable items={[item]} inventory={workspace.items} quantities={{[item.id]:1}} onQuantity={onQuantity} loading={false} disabled={false}/>);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText("Central Stock")).toBeVisible();expect(screen.getByText("Branch Stock")).toBeVisible();
  await userEvent.click(screen.getByRole("button",{name:`Increase ${item.name}`}));
  expect(onQuantity).toHaveBeenCalledWith(item,2);
  rerender(<OrderItemsTable items={[item]} inventory={[]} quantities={{[item.id]:item.available_stock}} onQuantity={onQuantity} loading={false} disabled={false}/>);
  expect(screen.getByRole("button",{name:`Increase ${item.name}`})).toBeDisabled();
});

it("desktop at 1024px retains the order table",()=>{
  mockViewport(1024);render(<OrderItemsTable items={[item]} inventory={[]} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  expect(screen.getByRole("table")).toBeVisible();
});

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

it("uses the branch threshold of three independently of the catalog threshold",()=>{
  const {rerender}=render(<OrderItemsTable items={[{...item,available_stock:2,low_stock_threshold:99}]} inventory={[]} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  expect(screen.getByText("Low Stock")).toBeVisible();
  rerender(<OrderItemsTable items={[{...item,available_stock:3,low_stock_threshold:99}]} inventory={[]} quantities={{}} onQuantity={vi.fn()} loading={false} disabled={false}/>);
  expect(screen.getByText("In Stock")).toBeVisible();
});
