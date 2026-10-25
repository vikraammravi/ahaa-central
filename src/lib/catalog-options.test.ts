import {expect,it} from "vitest";
import {selectableOptions} from "./catalog-options";
import {catalogOptions} from "@tests/mocks/catalog-options";
it("keeps inactive current options editable without offering them for new items",()=>{
  const options=catalogOptions.units.map(option=>({...option,is_active:option.name!=="Packet"}));
  expect(selectableOptions(options).some(option=>option.value==="Packet")).toBe(false);
  expect(selectableOptions(options,"Packet")).toContainEqual({value:"Packet",label:"Packet (archived)"});
});
