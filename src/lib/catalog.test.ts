import { expect,it } from "vitest";
import { compareCatalogItems } from "./catalog";
import { catalogFilterItems } from "@tests/mocks/fixtures";

it("orders normalized categories alphabetically, then item names",()=>{
  const sorted=[...catalogFilterItems].reverse().sort(compareCatalogItems);
  expect(sorted.map(item=>item.category)).toEqual(["Batter","Sweet","Packaging"]);
  expect(compareCatalogItems({name:"Zebra",category:"Pantry"},{name:"Apple",category:"Grocery"})).toBeGreaterThan(0);
});
