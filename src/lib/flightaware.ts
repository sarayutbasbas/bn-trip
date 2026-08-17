type AeroAirport={code?:string;code_iata?:string;name?:string};
type AeroFlight={
  fa_flight_id?:string;operator_iata?:string;operator?:string;operator_name?:string;status?:string;
  scheduled_out?:string;estimated_out?:string;actual_out?:string;scheduled_in?:string;estimated_in?:string;actual_in?:string;
  terminal_origin?:string;gate_origin?:string;terminal_destination?:string;gate_destination?:string;
  origin?:AeroAirport;destination?:AeroAirport;
};
type AeroSchedule={
  ident?:string;ident_iata?:string|null;ident_icao?:string|null;actual_ident?:string|null;
  actual_ident_iata?:string|null;actual_ident_icao?:string|null;fa_flight_id?:string|null;
  scheduled_out?:string;scheduled_in?:string;origin?:string;origin_iata?:string|null;
  origin_icao?:string|null;destination?:string;destination_iata?:string|null;destination_icao?:string|null;
};
type AeroAirportDetails={name?:string;city?:string;code_iata?:string|null;code_icao?:string|null};
type AeroOperatorDetails={name?:string;shortname?:string|null;iata?:string|null;icao?:string|null};

export type ResolvedFlight={
  providerFlightId:string|null;airlineName:string;departureAirportCode:string;departureAirportName:string;
  arrivalAirportCode:string;arrivalAirportName:string;scheduledDepartureAt:string;scheduledArrivalAt:string;
  latestDepartureAt:string|null;latestArrivalAt:string|null;departureTerminal:string|null;departureGate:string|null;
  arrivalTerminal:string|null;arrivalGate:string|null;status:string;
};

const API_ROOT="https://aeroapi.flightaware.com/aeroapi";
const LIVE_WINDOW_MS=36*60*60*1000;
const detailsCache=new Map<string,Promise<unknown>>();

function apiKey(){
  const value=process.env.FLIGHTAWARE_API_KEY?.trim();
  if(!value)throw new Error("flight_api_not_configured");
  return value;
}

async function request<T>(url:string):Promise<T>{
  for(let attempt=0;attempt<2;attempt+=1){
    try{
      const response=await fetch(url,{headers:{"x-apikey":apiKey()},cache:"no-store",signal:AbortSignal.timeout(15_000)});
      if(!response.ok){
        let reason="";
        try{const body=await response.json() as {reason?:string;detail?:string};reason=body.reason||body.detail||""}catch{}
        console.warn("FlightAware request rejected",{status:response.status,reason});
        throw new Error(`flight_provider_${response.status}`);
      }
      return await response.json() as T;
    }catch(error){
      const code=error instanceof Error?error.message:"";
      if(code.startsWith("flight_provider_")||code==="flight_api_not_configured")throw error;
      if(attempt===1){console.error("FlightAware network request failed",{message:code});throw new Error("flight_provider_network")}
    }
  }
  throw new Error("flight_provider_network");
}

function cachedRequest<T>(key:string,url:string):Promise<T>{
  const cached=detailsCache.get(key) as Promise<T>|undefined;
  if(cached)return cached;
  const pending=request<T>(url).catch(error=>{detailsCache.delete(key);throw error});
  detailsCache.set(key,pending);
  return pending;
}

async function enrichStaticDetails(flight:ResolvedFlight,operatorCode:string):Promise<ResolvedFlight>{
  const originPromise=flight.departureAirportName?Promise.resolve(null):cachedRequest<AeroAirportDetails>(`airport:${flight.departureAirportCode}`,`${API_ROOT}/airports/${encodeURIComponent(flight.departureAirportCode)}`);
  const destinationPromise=flight.arrivalAirportName?Promise.resolve(null):cachedRequest<AeroAirportDetails>(`airport:${flight.arrivalAirportCode}`,`${API_ROOT}/airports/${encodeURIComponent(flight.arrivalAirportCode)}`);
  const needsOperatorName=!flight.airlineName||/^[A-Z0-9]{2,3}$/.test(flight.airlineName);
  const operatorPromise=needsOperatorName?cachedRequest<AeroOperatorDetails>(`operator:${operatorCode}`,`${API_ROOT}/operators/${encodeURIComponent(operatorCode)}`):Promise.resolve(null);
  const [origin,destination,operator]=await Promise.allSettled([originPromise,destinationPromise,operatorPromise] as const);
  const originData=origin.status==="fulfilled"?origin.value:null;
  const destinationData=destination.status==="fulfilled"?destination.value:null;
  const operatorData=operator.status==="fulfilled"?operator.value:null;
  return {
    ...flight,
    departureAirportName:airportDisplayName(flight.departureAirportName||originData?.name||originData?.city||flight.departureAirportCode),
    arrivalAirportName:airportDisplayName(flight.arrivalAirportName||destinationData?.name||destinationData?.city||flight.arrivalAirportCode),
    airlineName:operatorData?.shortname||operatorData?.name||flight.airlineName||operatorCode,
  };
}

function nearest<T extends {scheduled_out?:string}>(items:T[],target:Date){
  return items.reduce<T|null>((best,item)=>{
    if(!item.scheduled_out)return best;
    if(!best?.scheduled_out)return item;
    return Math.abs(new Date(item.scheduled_out).getTime()-target.getTime())<Math.abs(new Date(best.scheduled_out).getTime()-target.getTime())?item:best;
  },null);
}

function airportCode(iata?:string|null,icao?:string|null,fallback?:string){
  return iata||icao?.replace(/^K(?=[A-Z]{3}$)/,"")||fallback?.replace(/^K(?=[A-Z]{3}$)/,"")||"";
}

function airportDisplayName(value:string){
  const cleaned=value.replace(/\s+(?:International(?:\s+Airport)?|Intl\.?|Int['’]l\.?)$/i,"").trim();
  return cleaned||value;
}

async function resolveLive(ident:string,target:Date):Promise<ResolvedFlight>{
  const start=new Date(target.getTime()-18*60*60*1000).toISOString();
  const end=new Date(target.getTime()+18*60*60*1000).toISOString();
  const url=`${API_ROOT}/flights/${encodeURIComponent(ident)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&max_pages=1`;
  const payload=await request<{flights?:AeroFlight[]}>(url);
  const flight=nearest(payload.flights||[],target);
  if(!flight)throw new Error("flight_not_found");
  const departureCode=airportCode(flight.origin?.code_iata,flight.origin?.code);
  const arrivalCode=airportCode(flight.destination?.code_iata,flight.destination?.code);
  if(!departureCode||!arrivalCode||!flight.scheduled_out||!flight.scheduled_in)throw new Error("flight_incomplete");
  return enrichStaticDetails({
    providerFlightId:flight.fa_flight_id||null,airlineName:flight.operator_name||flight.operator_iata||flight.operator||"",
    departureAirportCode:departureCode,departureAirportName:flight.origin?.name||"",arrivalAirportCode:arrivalCode,
    arrivalAirportName:flight.destination?.name||"",scheduledDepartureAt:flight.scheduled_out,scheduledArrivalAt:flight.scheduled_in,
    latestDepartureAt:flight.actual_out||flight.estimated_out||flight.scheduled_out,
    latestArrivalAt:flight.actual_in||flight.estimated_in||flight.scheduled_in,
    departureTerminal:flight.terminal_origin||null,departureGate:flight.gate_origin||null,
    arrivalTerminal:flight.terminal_destination||null,arrivalGate:flight.gate_destination||null,status:flight.status||"scheduled",
  },flight.operator||flight.operator_iata||ident.replace(/\d.*$/,""));
}

async function resolveSchedule(ident:string,target:Date):Promise<ResolvedFlight>{
  const match=ident.match(/^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/)||ident.match(/^([A-Z]{3})(\d{1,4})[A-Z]?$/);
  if(!match)throw new Error("flight_not_found");
  const start=new Date(target.getTime()-18*60*60*1000).toISOString();
  const end=new Date(target.getTime()+18*60*60*1000).toISOString();
  const params=new URLSearchParams({airline:match[1],flight_number:match[2],include_codeshares:"true",max_pages:"1"});
  const url=`${API_ROOT}/schedules/${encodeURIComponent(start)}/${encodeURIComponent(end)}?${params}`;
  const payload=await request<{scheduled?:AeroSchedule[]}>(url);
  const normalized=ident.toUpperCase();
  const candidates=payload.scheduled||[];
  const direct=candidates.filter(item=>[item.ident_iata,item.ident,item.ident_icao].some(value=>value?.replace(/[\s-]/g,"").toUpperCase()===normalized));
  const codeshare=candidates.filter(item=>[item.actual_ident_iata,item.actual_ident,item.actual_ident_icao].some(value=>value?.replace(/[\s-]/g,"").toUpperCase()===normalized));
  const flight=nearest(direct.length?direct:codeshare.length?codeshare:candidates,target);
  if(!flight?.scheduled_out||!flight.scheduled_in)throw new Error("flight_not_found");
  const departureCode=airportCode(flight.origin_iata,flight.origin_icao,flight.origin);
  const arrivalCode=airportCode(flight.destination_iata,flight.destination_icao,flight.destination);
  if(!departureCode||!arrivalCode)throw new Error("flight_incomplete");
  const operatorCode=(flight.ident_icao||flight.actual_ident_icao||"").match(/^[A-Z]{3}/)?.[0]||match[1];
  return enrichStaticDetails({
    providerFlightId:flight.fa_flight_id||null,airlineName:match[1],departureAirportCode:departureCode,
    departureAirportName:"",arrivalAirportCode:arrivalCode,arrivalAirportName:"",scheduledDepartureAt:flight.scheduled_out,
    scheduledArrivalAt:flight.scheduled_in,latestDepartureAt:flight.scheduled_out,latestArrivalAt:flight.scheduled_in,
    departureTerminal:null,departureGate:null,arrivalTerminal:null,arrivalGate:null,status:"scheduled",
  },operatorCode);
}

export async function resolveFlightAware(ident:string,around:string):Promise<ResolvedFlight>{
  const normalized=ident.replace(/[\s-]/g,"").toUpperCase();
  const target=new Date(around);
  if(Number.isNaN(target.getTime()))throw new Error("flight_invalid_date");

  // Live flight details only enter FlightAware's active window near departure.
  // Published schedules cover future flights; manual refresh switches to live details automatically later.
  if(target.getTime()-Date.now()>LIVE_WINDOW_MS)return resolveSchedule(normalized,target);
  try{return await resolveLive(normalized,target)}catch(error){
    const code=error instanceof Error?error.message:"";
    if(["flight_provider_400","flight_provider_404","flight_not_found","flight_incomplete"].includes(code))return resolveSchedule(normalized,target);
    throw error;
  }
}
