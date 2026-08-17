import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { resolveFlightAware } from "@/src/lib/flightaware";

export async function POST(_:Request,{params}:{params:Promise<{id:string;segmentId:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(session.isDemo)return NextResponse.json({error:"Demo mode is read-only",loginRequired:true},{status:403});
  const {id,segmentId}=await params;await ensureLatestDatabaseSchema();if(!await getTripRole(id,session.userId))return NextResponse.json({error:"Not found"},{status:404});
  const current=await query<{airline_code:string;flight_number:string;scheduled_departure_at:string}>("SELECT airline_code,flight_number,scheduled_departure_at FROM trip_flight_segments WHERE id=$1 AND trip_id=$2",[segmentId,id]);const segment=current.rows[0];if(!segment)return NextResponse.json({error:"Not found"},{status:404});
  try{const flight=await resolveFlightAware(`${segment.airline_code}${segment.flight_number}`,segment.scheduled_departure_at);
    const updated=await query(`UPDATE trip_flight_segments SET airline_name=$3,departure_airport_code=$4,departure_airport_name=$5,arrival_airport_code=$6,arrival_airport_name=$7,scheduled_departure_at=$8,scheduled_arrival_at=$9,latest_departure_at=$10,latest_arrival_at=$11,departure_terminal=$12,departure_gate=$13,arrival_terminal=$14,arrival_gate=$15,status=$16,provider='flightaware',provider_flight_id=$17,last_synced_at=now(),updated_at=now() WHERE id=$1 AND trip_id=$2 RETURNING *`,[segmentId,id,flight.airlineName,flight.departureAirportCode,flight.departureAirportName,flight.arrivalAirportCode,flight.arrivalAirportName,flight.scheduledDepartureAt,flight.scheduledArrivalAt,flight.latestDepartureAt,flight.latestArrivalAt,flight.departureTerminal,flight.departureGate,flight.arrivalTerminal,flight.arrivalGate,flight.status,flight.providerFlightId]);return NextResponse.json(updated.rows[0]);
  }catch(error){const code=error instanceof Error?error.message:"";console.error("Flight sync failed",{code,segmentId});return NextResponse.json({error:code==="flight_provider_401"||code==="flight_provider_403"?"Flight API key ใช้งานไม่ได้หรือไม่มีสิทธิ์":code==="flight_provider_429"?"เรียกข้อมูลเที่ยวบินถี่เกินไป กรุณารอสักครู่":code==="flight_not_found"||code==="flight_incomplete"||code==="flight_provider_400"||code==="flight_provider_404"?"ยังไม่พบข้อมูลเที่ยวบินสำหรับวันที่นี้":code==="flight_provider_network"?"เชื่อมต่อ FlightAware ไม่สำเร็จ กรุณาลองใหม่":"ดึงสถานะเที่ยวบินไม่สำเร็จ กรุณาลองใหม่ภายหลัง"},{status:502})}
}
