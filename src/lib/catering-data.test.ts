import { expect,it } from "vitest";
import { completePastCatering,fetchCatering } from "./catering-data";
import { db,queryResult } from "@tests/mocks/supabase";
import { branch } from "@tests/mocks/fixtures";

const asOf="2026-10-24T16:00:00.000Z";
it("runs dedicated catering maintenance once per location and business day",async()=>{
  db.rpc.mockReturnValue(queryResult(0));
  await completePastCatering(branch.id,"2099-01-01");await completePastCatering(branch.id,"2099-01-01");
  expect(db.rpc).toHaveBeenCalledTimes(1);
  await completePastCatering(branch.id,"2099-01-02");expect(db.rpc).toHaveBeenCalledTimes(2);
});
it("keeps inquiries available even when their event date or time has passed",async()=>{
  const query=queryResult([]);
  db.from.mockReturnValue(query);
  await fetchCatering({page:0,search:"",status:"INQUIRY",locationId:branch.id},new AbortController().signal,asOf);
  expect(query.eq).toHaveBeenCalledWith("status","INQUIRY");
  expect(query.gte).not.toHaveBeenCalled();
});
it("reads upcoming confirmed bookings without mutating any event",async()=>{
  const query=queryResult([]);
  db.from.mockReturnValue(query);
  await fetchCatering({page:0,search:"",status:"CONFIRMED",locationId:branch.id},new AbortController().signal,asOf);
  expect(query.update).not.toHaveBeenCalled();
  expect(query.eq).toHaveBeenCalledWith("status","CONFIRMED");
  expect(query.gte).toHaveBeenCalledWith("event_datetime","2026-10-24T04:00:00.000Z");
});

it("shows completed history only on explicit Completed and applies an inclusive Toronto date range",async()=>{
  const query=queryResult([]);
  db.from.mockReturnValue(query);
  await fetchCatering({page:0,search:"",status:"COMPLETED",locationId:branch.id,startDate:"2026-10-01",endDate:"2026-10-24"},new AbortController().signal,asOf);
  expect(query.eq).toHaveBeenCalledWith("status","COMPLETED");
  expect(query.gte).not.toHaveBeenCalledWith("event_datetime",asOf);
  expect(query.gte).toHaveBeenCalledWith("event_datetime","2026-10-01T04:00:00.000Z");
  expect(query.lt).toHaveBeenCalledWith("event_datetime","2026-10-25T04:00:00.000Z");
});

it("all statuses includes past and completed bookings without a hidden status or date restriction",async()=>{
  const query=queryResult([]);db.from.mockReturnValue(query);
  await fetchCatering({page:0,search:"",status:"ALL"},new AbortController().signal,asOf);
  expect(query.neq).not.toHaveBeenCalled();
  expect(query.gte).not.toHaveBeenCalled();
  expect(query.eq).not.toHaveBeenCalled();
});

it("all statuses respects the selected location, date and search",async()=>{
  const query=queryResult([]);
  db.from.mockReturnValue(query);
  await fetchCatering({page:0,search:"Nisha",status:"ALL",locationId:branch.id,startDate:"2026-10-01",endDate:"2026-10-01"},new AbortController().signal,asOf);
  expect(query.eq).toHaveBeenCalledWith("location_id",branch.id);
  expect(query.eq).not.toHaveBeenCalledWith("status",expect.anything());
  expect(query.gte).toHaveBeenCalledExactlyOnceWith("event_datetime","2026-10-01T04:00:00.000Z");
  expect(query.lt).toHaveBeenCalledWith("event_datetime","2026-10-02T04:00:00.000Z");
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining("Nisha"));
});

it("reversed dates do not query or change records",async()=>{
  db.from.mockClear();
  expect(await fetchCatering({page:0,search:"",status:"ALL",startDate:"2026-10-24",endDate:"2026-10-01"},new AbortController().signal,asOf)).toEqual({rows:[],count:0,page:0});
  expect(db.from).not.toHaveBeenCalled();
});
