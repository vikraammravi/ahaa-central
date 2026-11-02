import { expect,it } from "vitest";
import { compareCatalogItems } from "@/features/catalog/domain";
import { catalogFilterItems } from "@tests/mocks/fixtures";

it("orders managed categories alphabetically, then item names",()=>{
  const sorted=[...catalogFilterItems].reverse().sort(compareCatalogItems);
  expect(sorted.map(item=>item.category)).toEqual(["Batter","Desserts","Packaging"]);
  expect(compareCatalogItems({name:"Zebra",category:"Pantry"},{name:"Apple",category:"Grocery"})).toBeGreaterThan(0);
});
