import {expect,it} from "vitest";
import {branchStockStatus} from "./stock";
it.each([[0,"out-of-stock"],[1,"low-stock"],[2,"low-stock"],[3,"in-stock"],[10,"in-stock"],[null,null],[undefined,null]] as const)("classifies branch quantity %s as %s",(quantity,status)=>{
  expect(branchStockStatus(quantity)).toBe(status);
});
