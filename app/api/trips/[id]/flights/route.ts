import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query, transaction } from "@/src/lib/db";
import { flightSegmentSchema, splitFlightIdent } from "@/src/lib/flight-validation";
import { resolveFlightAware } from "@/src/lib/flightaware";
import { syncFlightLinkedRecords } from "@/src/lib/flight-linked-records";
import { getTripRole, tripMemberIdsAreMembers } from "@/src/lib/trip-access";
import { getStorageBackend } from "@/src/lib/storage";
import { getDemoFlightSegments, isDemoTrip } from "@/src/lib/demo-data";
import type { ResolvedFlight } from "@/src/lib/flightaware";

const denied=()=>NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
const segmentSelect=`SELECT flight.*,
  to_char(flight.entered_departure_local,'YYYY-MM-DD"T"HH24:MI') AS entered_departure_local_text,
  to_char(flight.entered_arrival_local,'YYYY-MM-DD"T"HH24:MI') AS entered_arrival_local_text,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',passenger.user_id,'seat_number',passenger.seat_number,'meal_preference',passenger.meal_preference,'carry_on_baggage',passenger.carry_on_baggage,'checked_baggage',passenger.checked_baggage,'display_name',member.display_name,'avatar_url',member.avatar_url) ORDER BY member.display_name) FROM trip_flight_passengers passenger JOIN users member ON member.id=passenger.user_id WHERE passenger.segment_id=flight.id),'[]'::jsonb) AS passengers,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',document.id,'title',document.title,'original_filename',document.original_filename,'mime_type',document.mime_type) ORDER BY document.created_at DESC) FROM trip_documents document WHERE document.flight_segment_id=flight.id),'[]'::jsonb) AS documents
  FROM trip_flight_segments flight`;

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;if(session.isDemo)return isDemoTrip(id)?NextResponse.json({segments:getDemoFlightSegments(id),syncConfigured:false,documentUploadMode:"server"}):NextResponse.json({error:"Not found"},{status:404});
  await ensureLatestDatabaseSchema();if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const result=await query(`${segmentSelect} WHERE flight.trip_id=$1 ORDER BY CASE flight.journey_type WHEN 'outbound' THEN 0 WHEN 'internal' THEN 1 ELSE 2 END,flight.segment_order,flight.scheduled_departure_at`,[id]);
  return NextResponse.json({segments:result.rows,syncConfigured:Boolean(process.env.FLIGHTAWARE_API_KEY),documentUploadMode:getStorageBackend()==="blob"?"client":"server"});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return denied();
  const {id}=await params;await ensureLatestDatabaseSchema();if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const parsed=flightSegmentSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"ข้อมูลเที่ยวบินไม่ถูกต้อง"},{status:400});
  const input=parsed.data;if(!await tripMemberIdsAreMembers(id,input.passengers.map((item)=>item.userId)))return NextResponse.json({error:"ผู้โดยสารไม่ได้อยู่ในทริปนี้"},{status:400});
  try{
    const ident=splitFlightIdent(input.flightIdent);
    const manual=Boolean(input.manualDepartureAirportCode&&input.manualArrivalAirportCode);
    const resolved:ResolvedFlight=manual?{
      providerFlightId:null,airlineName:input.manualAirlineName||ident.airlineCode,
      departureAirportCode:input.manualDepartureAirportCode,departureAirportName:input.manualDepartureAirportName||input.manualDepartureAirportCode,
      arrivalAirportCode:input.manualArrivalAirportCode,arrivalAirportName:input.manualArrivalAirportName||input.manualArrivalAirportCode,
      scheduledDepartureAt:input.scheduledDepartureAt,scheduledArrivalAt:input.scheduledArrivalAt,
      latestDepartureAt:null,latestArrivalAt:null,departureTerminal:null,departureGate:null,arrivalTerminal:null,arrivalGate:null,
      status:new Date(input.scheduledArrivalAt)<new Date()?"completed":"scheduled",
    }:await resolveFlightAware(input.flightIdent,input.scheduledDepartureAt);
    const segment=await transaction(async client=>{
      const previous=await client.query<{arrival_airport_code:string;scheduled_arrival_at:string}>(`SELECT arrival_airport_code,scheduled_arrival_at FROM trip_flight_segments WHERE trip_id=$1 AND journey_type=$2 AND segment_order<$3 ORDER BY segment_order DESC LIMIT 1`,[id,input.journeyType,input.segmentOrder]);
      const prior=previous.rows[0];if(prior&&(prior.arrival_airport_code!==resolved.departureAirportCode||new Date(prior.scheduled_arrival_at)>new Date(resolved.scheduledDepartureAt)))throw new Error("connection_mismatch");
      const result=await client.query(`INSERT INTO trip_flight_segments (trip_id,journey_type,segment_order,airline_code,airline_name,flight_number,departure_airport_code,departure_airport_name,arrival_airport_code,arrival_airport_name,scheduled_departure_at,scheduled_arrival_at,latest_departure_at,latest_arrival_at,departure_terminal,departure_gate,arrival_terminal,arrival_gate,status,booking_reference,cabin_class,baggage_note,provider,provider_flight_id,last_synced_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING *`,[id,input.journeyType,input.segmentOrder,ident.airlineCode,resolved.airlineName,ident.flightNumber,resolved.departureAirportCode,resolved.departureAirportName,resolved.arrivalAirportCode,resolved.arrivalAirportName,resolved.scheduledDepartureAt,resolved.scheduledArrivalAt,resolved.latestDepartureAt,resolved.latestArrivalAt,resolved.departureTerminal,resolved.departureGate,resolved.arrivalTerminal,resolved.arrivalGate,resolved.status,input.bookingReference||null,input.cabinClass||null,input.baggageNote||null,manual?'manual':'flightaware',resolved.providerFlightId,manual?null:new Date(),session.userId]);
      await client.query("UPDATE trip_flight_segments SET entered_departure_local=$2::timestamp,entered_arrival_local=$3::timestamp WHERE id=$1",[result.rows[0].id,input.enteredDepartureLocal,input.enteredArrivalLocal]);
      for(const passenger of input.passengers)await client.query(`INSERT INTO trip_flight_passengers (segment_id,user_id,seat_number,meal_preference,carry_on_baggage,checked_baggage) VALUES ($1,$2,$3,$4,$5,$6)`,[result.rows[0].id,passenger.userId,passenger.seatNumber||null,passenger.mealPreference||null,passenger.carryOnBaggage||null,passenger.checkedBaggage||null]);
      await syncFlightLinkedRecords(client,{tripId:id,segmentId:result.rows[0].id,flightLabel:`${ident.airlineCode}${ident.flightNumber}`,airlineName:resolved.airlineName,departureAirportCode:resolved.departureAirportCode,departureAirportName:resolved.departureAirportName,arrivalAirportCode:resolved.arrivalAirportCode,arrivalAirportName:resolved.arrivalAirportName,scheduledDepartureAt:resolved.scheduledDepartureAt,enteredDepartureLocal:input.enteredDepartureLocal,departureTerminal:resolved.departureTerminal,departureGate:resolved.departureGate,ticketPrice:input.ticketPrice,ticketCurrency:input.ticketCurrency,ticketExchangeRate:input.ticketExchangeRate,ticketRateDate:input.ticketRateDate,passengerIds:input.passengers.map(passenger=>passenger.userId)});
      await client.query("UPDATE trips SET has_flights=true,updated_at=now() WHERE id=$1",[id]);return result.rows[0];
    });
    return NextResponse.json(segment,{status:201});
  }catch(error){const code=error instanceof Error?error.message:"";console.error("Create flight failed",{code,flightIdent:input.flightIdent,scheduledDepartureAt:input.scheduledDepartureAt});return NextResponse.json({error:code==="connection_mismatch"?"เที่ยวบินต่อเครื่องต้องออกจากสนามบินที่เที่ยวบินก่อนหน้ามาถึง และเวลาไม่ย้อนกัน":code==="flight_api_not_configured"?"กรุณาตั้งค่า FLIGHTAWARE_API_KEY ก่อนเพิ่มเที่ยวบิน":code==="flight_provider_401"||code==="flight_provider_403"?"Flight API key ใช้งานไม่ได้หรือไม่มีสิทธิ์ กรุณาตรวจการตั้งค่า":code==="flight_provider_429"?"เรียกข้อมูลเที่ยวบินถี่เกินไป กรุณารอสักครู่แล้วลองใหม่":code==="flight_provider_network"?"เชื่อมต่อ FlightAware ไม่สำเร็จ กรุณาลองใหม่":code==="flight_not_found"||code==="flight_incomplete"||code==="flight_provider_400"||code==="flight_provider_404"?"ไม่พบข้อมูลเที่ยวบินนี้ กรุณาตรวจเลขเที่ยวบินและวันที่":"ดึงข้อมูลเที่ยวบินไม่สำเร็จ กรุณาลองใหม่"},{status:code==="flight_api_not_configured"||code==="flight_provider_network"?503:400})}
}
