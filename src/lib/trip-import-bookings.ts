import { z } from "zod";
import { splitFlightIdent } from "@/src/lib/flight-validation";
import type { ImportedTrip } from "@/src/lib/trip-import";

export const STAY_HEADERS = ["รหัสทริป", "ชื่อที่พัก", "โลเคชั่นหรือที่อยู่", "วันเช็กอิน", "เวลาเช็กอิน", "วันเช็กเอาต์", "เวลาเช็กเอาต์", "ราคารวมการจอง", "สกุลเงิน", "เรทเป็นบาท", "ช่องทางจอง", "รวมอาหารเช้า", "วิธีชำระเงิน", "รายละเอียด"];
export const FLIGHT_HEADERS = ["รหัสทริป", "ขาเที่ยวบิน", "ลำดับช่วงบิน", "เลขเที่ยวบิน", "สายการบิน", "สนามบินต้นทาง", "สนามบินปลายทาง", "วันที่ออก", "เวลาออก", "UTC ต้นทาง", "วันที่ถึง", "เวลาถึง", "UTC ปลายทาง", "ราคาตั๋ว", "สกุลเงิน", "เรทเป็นบาท", "รหัสจอง", "ชั้นโดยสาร", "ที่นั่ง", "อาหาร", "กระเป๋าถือขึ้นเครื่อง", "กระเป๋าโหลด"];
export class ImportCellError extends Error {
  constructor(public column: number, message: string) { super(message); }
}
export function cellAddress(column: number, row: number) {
  let text = "";
  while (column > 0) { column--; text = String.fromCharCode(65 + column % 26) + text; column = Math.floor(column / 26); }
  return `${text}${row}`;
}
function fail(column: number, message: string): never { throw new ImportCellError(column, message); }
function text(value: string, column: number, max: number, required = false) {
  if ((required && !value) || value.length > max) fail(column, `กรอก${required ? "อย่างน้อย 1 และ" : ""}ไม่เกิน ${max} ตัวอักษร`);
  return value;
}
function day(value: string, column: number) {
  if (!z.string().date().safeParse(value).success) fail(column, "วันที่ใช้ ค.ศ. YYYY-MM-DD");
  return value;
}
function time(value: string, column: number, fallback?: string) {
  value ||= fallback || "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(column, "เวลาใช้ HH:mm เช่น 09:30");
  return value;
}
function money(values: string[], amountColumn: number) {
  const amount = Number(values[amountColumn - 1].replace(/,/g, "") || "0");
  const currency = (values[amountColumn] || "THB").toUpperCase();
  const rate = Number(values[amountColumn + 1] || (currency === "THB" ? "1" : "NaN"));
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999) fail(amountColumn, "จำนวนเงินต้องอยู่ระหว่าง 0–999,999,999");
  if (!Intl.supportedValuesOf("currency").includes(currency)) fail(amountColumn + 1, "ใช้รหัสสกุลเงิน เช่น THB, JPY, VND");
  if (!Number.isFinite(rate) || rate <= 0 || rate > 999999 || (currency === "THB" && rate !== 1)) fail(amountColumn + 2, "กรอกเรทย้อนหลังที่มากกว่า 0; THB ใช้ 1");
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) fail(amountColumn, "จำนวนเงินใช้ทศนิยมไม่เกิน 2 ตำแหน่ง");
  if (rate < 0.000001 || Math.abs(rate * 1000000 - Math.round(rate * 1000000)) > 0.00001) fail(amountColumn + 2, "เรทใช้ทศนิยมไม่เกิน 6 ตำแหน่ง และไม่น้อยกว่า 0.000001");
  if (amount * rate > 999999999) fail(amountColumn, "ยอดแปลงเป็นบาทต้องไม่เกิน 999,999,999");
  return { amount, currency, rate };
}
export function parseImportedStay(c: string[], row: number, trip: ImportedTrip | undefined) {
  if (!trip) fail(1, "ไม่พบรหัสทริปในชีต ทริป");
  const checkInDate = day(c[3], 4), checkOutDate = day(c[5], 6);
  if (trip.totalDays <= 1) fail(1, "ทริปวันเดียวไม่รองรับการเพิ่มที่พัก");
  if (checkInDate < trip.outboundDate || checkInDate > trip.returnDate) fail(4, "วันเช็กอินอยู่นอกทริป");
  const checkInDay = Math.round((Date.parse(checkInDate) - Date.parse(trip.outboundDate)) / 86400000) + 1;
  const checkOutDay = Math.round((Date.parse(checkOutDate) - Date.parse(trip.outboundDate)) / 86400000) + 1;
  if (checkOutDay <= checkInDay || checkOutDay > trip.totalDays + 1) fail(6, "เช็กเอาต์ต้องหลังเช็กอิน และไม่เกินหนึ่งวันหลังสิ้นสุดทริป");
  const bookingPlatform = (c[10] || "direct").toLowerCase();
  if (!["agoda", "trip.com", "booking.com", "klook", "traveloka", "direct"].includes(bookingPlatform)) fail(11, "เลือกช่องทางจาก dropdown; จองเองใช้ direct");
  if (!["", "ใช่", "ไม่", "yes", "no"].includes(c[11].toLowerCase())) fail(12, "กรอก ใช่ หรือ ไม่");
  return { tripCode: trip.code, row, name: text(c[1], 2, 180, true), location: text(c[2], 3, 1000),
    checkInDate, checkInDay, checkOutDay, checkInTime: time(c[4], 5, "14:00"), checkOutTime: time(c[6], 7, "12:00"),
    ...money(c, 8), bookingPlatform, includesBreakfast: ["ใช่", "yes"].includes(c[11].toLowerCase()),
    paymentMethod: text(c[12] || "เงินสด", 13, 260), description: text(c[13], 14, 2000) };
}
function utc(dateText: string, timeText: string, offset: string, column: number) {
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset) || (offset.slice(1, 3) === "14" && offset.slice(4) !== "00")) fail(column, "กรอก UTC offset เช่น +07:00 (ไทย/เวียดนาม), +09:00 (ญี่ปุ่น)");
  return new Date(`${dateText}T${timeText}:00${offset}`).toISOString();
}
export function parseImportedFlight(c: string[], row: number, trip: ImportedTrip | undefined) {
  if (!trip) fail(1, "ไม่พบรหัสทริปในชีต ทริป");
  const journey = ({ "ขาไป": "outbound", "ขากลับ": "return", "ภายในทริป": "internal", outbound: "outbound", return: "return", internal: "internal" } as Record<string, string>)[c[1].toLowerCase()];
  if (!journey) fail(2, "เลือก ขาไป, ขากลับ หรือ ภายในทริป");
  const order = Number(c[2] || "1");
  if (!Number.isInteger(order) || order < 1 || order > 21) fail(3, "ลำดับช่วงบินต้องเป็น 1–21; ต่อเครื่องให้เพิ่มแถวลำดับ 2, 3…");
  let ident: ReturnType<typeof splitFlightIdent>;
  try { ident = splitFlightIdent(c[3]); } catch { fail(4, "กรอกเลขเที่ยวบิน เช่น TG670 หรือ VN616"); }
  const departureCode = c[5].toUpperCase(), arrivalCode = c[6].toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(departureCode)) fail(6, "รหัสสนามบิน 3–4 ตัว เช่น BKK");
  if (!/^[A-Z0-9]{3,4}$/.test(arrivalCode) || arrivalCode === departureCode) fail(7, "กรอกรหัสสนามบินปลายทางที่ต่างจากต้นทาง");
  const departureDate = day(c[7], 8), arrivalDate = day(c[10], 11);
  if (departureDate < trip.outboundDate || departureDate > trip.returnDate) fail(8, "วันที่ออกต้องอยู่ในช่วงทริป");
  const departureTime = time(c[8], 9), arrivalTime = time(c[11], 12);
  const departureAt = utc(departureDate, departureTime, c[9], 10), arrivalAt = utc(arrivalDate, arrivalTime, c[12], 13);
  if (arrivalAt <= departureAt || Date.parse(arrivalAt) - Date.parse(departureAt) > 48 * 3600000) fail(11, "เวลาถึงหลังแปลง UTC ต้องหลังเวลาออก และช่วงบินไม่เกิน 48 ชั่วโมง ตรวจวันที่ เวลา และ UTC ทั้งสองฝั่ง");
  return { tripCode: trip.code, row, journey, order: order - 1, ...ident!, airlineName: text(c[4] || ident!.airlineCode, 5, 120), departureCode, arrivalCode,
    departureDate, departureAt, arrivalAt, departureLocal: `${departureDate}T${departureTime}`, arrivalLocal: `${arrivalDate}T${arrivalTime}`,
    ...money(c, 14), bookingReference: text(c[16], 17, 80), cabinClass: text(c[17], 18, 80), seat: text(c[18], 19, 24), meal: text(c[19], 20, 160), carryOn: text(c[20], 21, 160), checked: text(c[21], 22, 160) };
}
export type ImportedStay = ReturnType<typeof parseImportedStay>;
export type ImportedFlight = ReturnType<typeof parseImportedFlight>;
