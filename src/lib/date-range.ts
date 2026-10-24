import { BUSINESS_TIME_ZONE } from "./format";

export function businessDateKey(value:string|Date):string {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:BUSINESS_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(typeof value==="string"?new Date(value):value).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Resolve midnight in the business time zone, including DST boundary dates.
export function businessDayStart(date:string,followingDay=false):string {
  const parsed=new Date(`${date}T00:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error("Choose a valid date.");
  if(followingDay)parsed.setUTCDate(parsed.getUTCDate()+1);
  const target=parsed.getTime();let timestamp=target;
  const formatter=new Intl.DateTimeFormat("en-US",{timeZone:BUSINESS_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  for(let attempt=0;attempt<3;attempt++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part=>[part.type,part.value]));
    const local=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    const difference=target-local;
    timestamp+=difference;if(difference===0)break;
  }
  return new Date(timestamp).toISOString();
}
