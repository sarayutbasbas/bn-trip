import { z } from "zod";

const optionalText=(max:number)=>z.string().trim().max(max).optional().default("");
const optionalAirportCode=z.string().trim().max(4).optional().default("").transform(value=>value.toUpperCase()).refine(value=>!value||/^[A-Z0-9]{3,4}$/.test(value),"กรุณากรอกรหัสสนามบิน 3–4 ตัว เช่น BKK");
export const flightPassengerSchema=z.object({userId:z.string().uuid(),seatNumber:optionalText(24),mealPreference:optionalText(160),baggageNote:optionalText(500)});
export const flightSegmentSchema=z.object({
  journeyType:z.enum(["outbound","return","internal"]),segmentOrder:z.coerce.number().int().min(0).max(20),
  flightIdent:z.string().trim().min(3).max(16).transform(value=>value.replace(/[\s-]/g,"").toUpperCase()).refine(value=>/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(value),"กรุณากรอกเลขเที่ยวบิน เช่น TG670"),
  scheduledDepartureAt:z.string().datetime(),scheduledArrivalAt:z.string().datetime(),
  enteredDepartureLocal:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  enteredArrivalLocal:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  ticketPrice:z.coerce.number().nonnegative().optional().default(0),
  ticketCurrency:z.string().trim().length(3).transform(value=>value.toUpperCase()),
  ticketExchangeRate:z.coerce.number().positive("ไม่พบอัตราแลกเปลี่ยน"),
  ticketRateDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bookingReference:optionalText(80),cabinClass:optionalText(80),baggageNote:optionalText(1000),passengers:z.array(flightPassengerSchema).min(1,"กรุณาเลือกผู้โดยสารอย่างน้อย 1 คน").max(30),
  manualAirlineName:optionalText(120),manualDepartureAirportCode:optionalAirportCode,manualDepartureAirportName:optionalText(160),manualArrivalAirportCode:optionalAirportCode,manualArrivalAirportName:optionalText(160),
}).refine(value=>new Date(value.scheduledArrivalAt)>new Date(value.scheduledDepartureAt),{message:"เวลาถึงต้องอยู่หลังเวลาออกเดินทาง",path:["scheduledArrivalAt"]});

export function splitFlightIdent(ident:string){
  const normalized=ident.replace(/[\s-]/g,"").toUpperCase();
  // Prefer the two-character IATA designator (TG670 => TG + 670).
  // A three-letter ICAO designator is accepted when the third character is a letter (THA670 => THA + 670).
  const match=normalized.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/)||normalized.match(/^([A-Z]{3})(\d{1,4}[A-Z]?)$/);
  if(!match)throw new Error("invalid_ident");
  return {airlineCode:match[1],flightNumber:match[2]};
}
