import { expect,it } from "vitest";
import { businessDateKey,businessDayStart } from "./date-range";

it("uses Toronto midnight and an exclusive next-day boundary across DST",()=>{
  expect(businessDayStart("2026-10-24")).toBe("2026-10-24T04:00:00.000Z");
  expect(businessDayStart("2026-03-08")).toBe("2026-03-08T05:00:00.000Z");
  expect(businessDayStart("2026-03-08",true)).toBe("2026-03-09T04:00:00.000Z");
  expect(businessDayStart("2026-11-01")).toBe("2026-11-01T04:00:00.000Z");
  expect(businessDayStart("2026-11-01",true)).toBe("2026-11-02T05:00:00.000Z");
});

it("keeps the saved booking date in the Toronto business time zone",()=>{
  expect(businessDateKey("2026-10-24T02:00:00Z")).toBe("2026-10-23");
});

it("rejects malformed and impossible calendar dates",()=>{
  for(const value of ["","invalid","2026-02-30","10/24/2026"])expect(()=>businessDayStart(value)).toThrow("Choose a valid date");
});
