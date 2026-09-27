import ExcelJS from "exceljs";
import { STAY_HEADERS, FLIGHT_HEADERS, ImportCellError, cellAddress, parseImportedStay, parseImportedFlight, type ImportedStay, type ImportedFlight } from "@/src/lib/trip-import-bookings";
import { z } from "zod";
import { TRIP_COUNTRIES, formatTripDestination } from "@/src/lib/countries";
import { createCustomTripDestination, resolveTripDestinations, TRIP_DESTINATION_OPTIONS } from "@/src/lib/travel-badges";

export const IMPORT_HEADERS = ["ชื่อทริป", "ประเทศ", "เมือง", "วันเดินทางไป", "วันเดินทางกลับ", "เวลาไป", "เวลากลับ", "งบหลัก (บาท)", "งบช้อปปิ้ง (บาท)", "มีเที่ยวบิน", "โน้ต"];
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
// Reserved across every data sheet; never infer example rows from colour or position.
export const IMPORT_EXAMPLE_CODE = "__EXAMPLE__";
export const TIMELINE_HEADERS = ["รหัสทริป", "รหัสรายการ", "วันที่", "เวลา", "ชื่อรายการ", "โลเคชั่นหรือที่อยู่", "วิธีเดินทาง", "รายละเอียด"];
export const EXPENSE_HEADERS = ["รหัสทริป", "รหัสรายการ", "วันที่", "ชื่อค่าใช้จ่าย", "ประเภท", "จำนวนเงิน", "สกุลเงิน", "เรทเป็นบาท", "วิธีชำระเงิน"];
export const IMPORT_CATEGORIES = ["อาหาร", "เดินทาง", "ค่าตั๋วเครื่องบิน", "ที่พัก", "Shopping", "กิจกรรม", "ของฝาก", "อื่น ๆ"];
export type ImportedCost = { key: string; value: number; category: string; currency: string; foreignAmount: number; exchangeRate: number; rateDate: string; paymentMethod: string };
export type ImportedPlan = { tripCode: string; code: string; day: number; date: string; time: string; name: string; address: string; transport: string; note: string; costs: ImportedCost[]; row: number };
const date = z.string().date().refine(value => value >= "1900-01-01" && value <= "2200-12-31", "ใช้วันที่ ค.ศ. ระหว่างปี 1900–2200");
const rowSchema = z.object({
  name: z.string().trim().min(2, "ชื่อทริปอย่างน้อย 2 ตัวอักษร").max(160, "ชื่อทริปไม่เกิน 160 ตัวอักษร"),
  outboundDate: date, returnDate: date,
  outboundTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "เวลาใช้รูปแบบ HH:mm"),
  returnTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "เวลาใช้รูปแบบ HH:mm"),
  budget: z.number().min(0).max(999999999), shoppingBudget: z.number().min(0).max(999999999),
  note: z.string().trim().max(500, "โน้ตไม่เกิน 500 ตัวอักษร"),
}).refine(row => `${row.returnDate}T${row.returnTime}` >= `${row.outboundDate}T${row.outboundTime}`, "วันและเวลากลับต้องไม่ก่อนเวลาไป");
export type ImportedTrip = z.infer<typeof rowSchema> & { code: string; row: number; countryCode: string; countryName: string; timezone: string; destinations: ReturnType<typeof resolveTripDestinations>; destination: string; totalDays: number; hasFlights: boolean };
export type TripImportBatch = { trips: ImportedTrip[]; plans: ImportedPlan[]; expenseCount: number; stays: ImportedStay[]; flights: ImportedFlight[] };

export async function createTripTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ทริป");
  sheet.addRow(["รหัสทริป", ...IMPORT_HEADERS]);
  sheet.columns = ["รหัสทริป", ...IMPORT_HEADERS].map((header, index) => ({ header, width: index === 11 ? 45 : 24 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF7518" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (let row = 3; row <= 102; row++) {
    for (const column of [5, 6, 7, 8]) sheet.getCell(row, column).numFmt = "@";
    sheet.getCell(row, 11).dataValidation = { type: "list", allowBlank: true, formulae: ['"ใช่,ไม่"'] };
  }
  sheet.getCell("A1").note = "ตั้งรหัสเอง เช่น TRIP01 แล้วใช้รหัสเดียวกันในชีตไทม์ไลน์และค่าใช้จ่าย";
  workbook.definedNames.add("'ทริป'!$A$3:$A$102", "TripCodes");
  for (const [name, headers] of [["ไทม์ไลน์", TIMELINE_HEADERS], ["ค่าใช้จ่าย", EXPENSE_HEADERS], ["ที่พัก", STAY_HEADERS], ["เที่ยวบิน", FLIGHT_HEADERS]] as const) {
    const child = workbook.addWorksheet(name);
    child.columns = headers.map(header => ({ header, width: 25 }));
    child.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    child.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF7518" } };
    child.views = [{ state: "frozen", ySplit: 1 }];
    child.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };
    headers.forEach((header, index) => { if (header.startsWith("วัน") || header.startsWith("เวลา") || header.startsWith("UTC")) child.getColumn(index + 1).numFmt = "@"; });
    for (let row = 2; row <= 501; row++) child.getCell(row, 1).dataValidation = { type: "list", allowBlank: true, formulae: ["TripCodes"] };
    if (name === "ไทม์ไลน์") child.getColumn(4).numFmt = "@";
    if (name === "ค่าใช้จ่าย") for (let row = 2; row <= 501; row++) child.getCell(row, 5).dataValidation = { type: "list", allowBlank: true, formulae: [`"${IMPORT_CATEGORIES.join(",")}"`] };
    for (let row = 2; row <= 501; row++) {
      if (name === "ที่พัก") {
        child.getCell(row, 11).dataValidation = { type: "list", allowBlank: true, formulae: ['"agoda,trip.com,booking.com,klook,traveloka,direct"'] };
        child.getCell(row, 12).dataValidation = { type: "list", allowBlank: true, formulae: ['"ใช่,ไม่"'] };
      }
      if (name === "เที่ยวบิน") child.getCell(row, 2).dataValidation = { type: "list", allowBlank: true, formulae: ['"ขาไป,ขากลับ,ภายในทริป"'] };
    }
  }
  const help = workbook.addWorksheet("วิธีใช้และตัวอย่าง");
  help.getColumn(1).width = 110;
  ["เริ่มที่ชีต ทริป: 1 แถวต่อ 1 ทริป สูงสุด 100 ทริปต่อไฟล์",
    "ทุกชีตข้อมูลมีแถวตัวอย่างสีเหลือง รหัส __EXAMPLE__ ระบบข้ามแถวนี้เสมอ ไม่สร้างข้อมูล",
    "กรอกข้อมูลจริงตั้งแต่แถว 3 หรือคัดลอกตัวอย่างแล้วเปลี่ยนรหัสทริปเป็นรหัสของคุณ เช่น TRIP01 ในทุกชีตที่เกี่ยวข้อง อย่าใช้ __EXAMPLE__ กับข้อมูลจริง",
    "จำเป็น: ชื่อทริป, ประเทศ (รหัสหรือชื่อไทย/อังกฤษ), เมือง, วันเดินทางไป, วันเดินทางกลับ",
    "หลายเมืองให้คั่นด้วย | เช่น ฮานอย | ดานัง",
    "วันที่ใช้ ค.ศ. YYYY-MM-DD เช่น 2026-11-01; ทริปยาวไม่เกิน 90 วัน; เวลา HH:mm (ว่าง = ไป 09:00 / กลับ 18:00)",
    "งบหลักและงบช้อปปิ้งเป็นบาท ใส่ตัวเลข 0 ขึ้นไป (ว่าง = 0); มีเที่ยวบิน: ใช่/ไม่ (ว่าง = ไม่)",
    "ตั้งรหัสทริปที่คอลัมน์แรก เช่น TRIP01 ใช้เชื่อมทั้ง 5 ชีต รหัสไม่ซ้ำกันในไฟล์ (A-Z, 0-9, - หรือ _)",
    "ไทม์ไลน์: รหัสทริป + รหัสรายการที่ตั้งเอง เช่น PLAN01 + วันที่จริง + ชื่อรายการ; เวลาเว้นว่างได้ ระบบจัดต่อกันเริ่ม 09:00",
    "รหัสรายการใช้ซ้ำต่างทริปได้ แต่ห้ามซ้ำในทริปเดียวกัน; วันไทม์ไลน์และค่าใช้จ่ายต้องอยู่ระหว่างวันไปและกลับ",
    "ค่าใช้จ่าย: ใส่รหัสทริป + รหัสรายการเพื่อผูกกับไทม์ไลน์ วันที่เว้นว่างได้ ระบบใช้วันที่ของรายการนั้น",
    "ถ้าไม่ทราบรายการไทม์ไลน์: เว้นรหัสรายการ แล้วใส่วันที่ ระบบสร้างรายการรวมค่าใช้จ่ายรายวันให้ แบ่งอัตโนมัติทุก 30 ค่าใช้จ่าย",
    "ค่าใช้จ่ายทุกแถวเป็นยอดใช้จริง: จำนวนเงินตามสกุลเงิน; สกุลเงินว่าง = THB; THB เรท = 1; เงินต่างประเทศต้องใส่เรท 1 หน่วย = กี่บาท",
    "ใช้เรทย้อนหลังของคุณเอง ไม่มีการดึงเรทปัจจุบัน; ระบบคำนวณยอดบาทและรวมในหน้าค่าใช้จ่ายทันที",
    "งบในชีต ทริป คือวงเงินงบประมาณ ไม่ใช่ยอดใช้จริง; ยอดใช้จริงกรอกชีต ค่าใช้จ่าย เท่านั้น เพื่อไม่ให้นับซ้ำ",
    "การนำเข้ารอบนี้สร้างทริปใหม่พร้อมไทม์ไลน์ ไม่เพิ่มเข้าทริปเดิม; นำเข้าไฟล์เดิมซ้ำจะข้ามทั้งทริป",
    "ค่าใช้จ่ายและผู้โดยสารเป็นของบัญชีที่นำเข้า แก้การหารหรือเพิ่มผู้ร่วมทริปภายหลังได้",
    "ที่พัก: 1 แถวต่อการจอง ใส่ราคารวมทั้งการจอง ไม่ใช่ราคาต่อคืน; ระบบสร้างคืนที่พักและค่าใช้จ่ายในไทม์ไลน์ให้เอง",
    "เที่ยวบิน: 1 แถวต่อช่วงบิน; ขาไป/ขากลับ/ภายในทริป; ต่อเครื่องใช้ลำดับ 1, 2, 3 ตามลำดับเวลา",
    "กรอกวันเวลาเที่ยวบินตามตั๋วในเวลาท้องถิ่น และ UTC offset ของแต่ละสนามบิน ณ วันเดินทาง เช่น +07:00 ไทย/เวียดนาม, +09:00 ญี่ปุ่น (ประเทศที่มี DST ต้องใช้ offset ของวันนั้น)",
    "ราคาตั๋วรวมไปกลับ ให้ลงราคาเพียงแถวเดียว แถวอื่นใส่ 0; ไม่ต้องลงค่าที่พักหรือตั๋วซ้ำในชีต ค่าใช้จ่าย หรือสร้างไทม์ไลน์ซ้ำ",
    "เที่ยวบินนำเข้าแบบกรอกเอง ไม่ดึงหรืออัปเดตข้อมูลเที่ยวบินย้อนหลังจากผู้ให้บริการ",
    "ที่พักและเที่ยวบินได้สูงสุดชีตละ 500 แถว; รูปที่พักและเอกสารแนบเพิ่มภายหลังในแอป",
    "สูงสุด 2,000 รายการไทม์ไลน์ และ 5,000 ค่าใช้จ่ายต่อไฟล์; โน้ตทริปไม่เกิน 500 ตัวอักษร",
    "ข้อมูลตัวอย่างด้านล่างไม่ถูกนำเข้า ให้กรอกข้อมูลจริงในชีต ทริป",
    "ระบบตรวจทุกแถวก่อนสร้าง หากมีแถวผิดจะไม่สร้างทริปใด ๆ; ส่งไฟล์เดิมซ้ำจะไม่สร้างซ้ำ",
  ].forEach(text => help.addRow([text]));
  help.addRow(["รหัสทริป", ...IMPORT_HEADERS]);
  help.addRow(["TRIP01", "เที่ยวเวียดนาม", "VN", "ฮานอย | ดานัง", "2025-11-01", "2025-11-05", "09:00", "18:00", 20000, 5000, "ใช่", "ทริปกับครอบครัว"]);
  help.addRow(TIMELINE_HEADERS);
  help.addRow(["TRIP01", "PLAN01", "2025-11-01", "12:00", "กินเฝอ", "ฮานอย", "เดิน", "ร้านที่ชอบ"]);
  help.addRow(EXPENSE_HEADERS);
  help.addRow(["TRIP01", "PLAN01", "", "เฝอ 2 ชาม", "อาหาร", 100000, "VND", 0.0013, "เงินสด"]);
  help.addRow(["TRIP01", "PLAN01", "", "กาแฟ", "อาหาร", 60, "THB", 1, "เงินสด"]);
  help.addRow(["TRIP01", "", "2025-11-02", "แท็กซี่ทั้งวัน", "เดินทาง", 350, "THB", 1, "เงินสด"]);
  help.addRow(STAY_HEADERS);
  help.addRow(["TRIP01", "Hanoi Hotel", "ฮานอย", "2025-11-01", "14:00", "2025-11-05", "12:00", 8000, "THB", 1, "agoda", "ใช่", "เงินสด", "ห้องพักรวมทั้งการจอง"]);
  help.addRow(FLIGHT_HEADERS);
  help.addRow(["TRIP01", "ขาไป", 1, "VN616", "Vietnam Airlines", "BKK", "HAN", "2025-11-01", "10:00", "+07:00", "2025-11-01", "12:00", "+07:00", 6000, "THB", 1, "ABC123", "Economy", "12A", "", "7 kg", "23 kg"]);
  const countries = workbook.addWorksheet("ประเทศ");
  countries.addRow(["รหัส", "ชื่อไทย", "ชื่ออังกฤษ"]);
  TRIP_COUNTRIES.forEach(country => countries.addRow([country.code, country.nameTh, country.nameEn]));
  countries.columns.forEach(column => { column.width = 30; });
  const examples: Array<[string, (string | number)[]]> = [
    ["ทริป", [IMPORT_EXAMPLE_CODE, "เที่ยวเวียดนาม", "VN", "ฮานอย | ดานัง", "2025-11-01", "2025-11-05", "08:00", "18:00", 20000, 5000, "ใช่", "ทริปกับครอบครัว"]],
    ["ไทม์ไลน์", [IMPORT_EXAMPLE_CODE, "PLAN01", "2025-11-01", "12:00", "กินเฝอ", "ฮานอย", "เดิน", "ร้านที่ชอบ"]],
    ["ค่าใช้จ่าย", [IMPORT_EXAMPLE_CODE, "PLAN01", "", "เฝอ 2 ชาม", "อาหาร", 100000, "VND", 0.0013, "เงินสด"]],
    ["ที่พัก", [IMPORT_EXAMPLE_CODE, "Hanoi Hotel", "ฮานอย", "2025-11-01", "14:00", "2025-11-05", "12:00", 8000, "THB", 1, "agoda", "ใช่", "เงินสด", "ราคารวมทั้งการจอง"]],
    ["เที่ยวบิน", [IMPORT_EXAMPLE_CODE, "ขาไป", 1, "VN616", "Vietnam Airlines", "BKK", "HAN", "2025-11-01", "10:00", "+07:00", "2025-11-01", "12:00", "+07:00", 6000, "THB", 1, "ABC123", "Economy", "12A", "", "7 kg", "23 kg"]],
  ];
  for (const [name, values] of examples) {
    const target = workbook.getWorksheet(name)!;
    const row = target.getRow(2);
    row.values = [...values, "ตัวอย่างเท่านั้น — ไม่นำเข้า กรอกข้อมูลจริงตั้งแต่แถว 3"];
    row.height = 44;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDB3" } };
      cell.font = { color: { argb: "FF785000" }, italic: true };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.note = "ตัวอย่างเท่านั้น ไม่นำเข้า: คัดลอกแล้วเปลี่ยนรหัส __EXAMPLE__ เป็นรหัสทริปจริง";
      cell.dataValidation = { type: "custom", allowBlank: true, formulae: ["TRUE()"] };
    });
    target.getColumn(1).width = 26;
    target.getColumn(values.length + 1).width = 48;
    target.getCell(1, values.length + 1).value = "คำแนะนำ (ไม่ต้องกรอก)";
    target.views = [{ state: "frozen", ySplit: 2 }];
  }
  return workbook.xlsx.writeBuffer();
}

function cellText(cell: ExcelJS.Cell, time = false) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return time ? value.toISOString().slice(11, 16) : value.toISOString().slice(0, 10);
  if (time && typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  if (typeof value === "object") throw new Error("กรุณาใช้ค่าข้อความหรือตัวเลข ไม่ใช้สูตรในเซลล์");
  return String(value).trim();
}

export async function parseTripImport(buffer: ArrayBuffer): Promise<TripImportBatch> {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw new Error("อ่านไฟล์ไม่ได้ กรุณาใช้เทมเพลต Excel (.xlsx)"); }
  const sheet = workbook.getWorksheet("ทริป");
  const codeFirst = sheet?.getCell(1, 1).text.trim() === "รหัสทริป";
  const offset = codeFirst ? 1 : 0;
  if (!sheet || IMPORT_HEADERS.some((header, index) => sheet.getCell(1, index + 1 + offset).text.trim() !== header)) throw new Error("หัวตารางไม่ตรงกับเทมเพลต กรุณาดาวน์โหลดเทมเพลตใหม่");
  const trips: ImportedTrip[] = [];
  const errors: string[] = [];
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    if (codeFirst && row.getCell(1).text.trim().toUpperCase() === IMPORT_EXAMPLE_CODE) continue;
    if (Array.from({ length: 12 }, (_, column) => row.getCell(column + 1).text.trim()).every(value => !value)) continue;
    try {
      const cells = IMPORT_HEADERS.map((_, column) => {
        try { return cellText(row.getCell(column + 1 + offset), column === 5 || column === 6); }
        catch (error) { throw new ImportCellError(column + 1 + offset, error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง"); }
      });
      const code = codeFirst ? cellText(row.getCell(1)).toUpperCase() : sheet.getCell(1, 12).text.trim() === "รหัสทริป" ? cellText(row.getCell(12)).toUpperCase() : "";
      if (code && !/^[A-Z0-9_-]{1,40}$/.test(code)) throw new Error("รหัสทริปใช้ A-Z, 0-9, - หรือ _ ไม่เกิน 40 ตัว");
      if (code && trips.some(trip => trip.code === code)) throw new Error(`รหัสทริป ${code} ซ้ำ`);
      const [name, countryText, cityText, outboundDate, returnDate, outboundTime, returnTime, budget, shoppingBudget, flightText, note] = cells;
      const country = TRIP_COUNTRIES.find(item => [item.code, item.nameTh, item.nameEn, ...(item.aliases || [])].some(value => value.toLowerCase() === countryText.toLowerCase()));
      if (!country) throw new Error("ไม่พบประเทศ ใช้รหัสหรือชื่อจากชีต ประเทศ");
      const cities = [...new Set(cityText.split("|").map(value => value.trim()).filter(Boolean))];
      if (!cities.length || cities.length > 20 || cities.some(city => city.length > 80)) throw new Error("กรุณาระบุเมือง 1–20 เมือง เมืองละไม่เกิน 80 ตัวอักษร");
      const destinations = resolveTripDestinations(country.code, cities.map(city => {
        const match = TRIP_DESTINATION_OPTIONS.find(option => option.countryCode === country.code && [option.nameTh, option.nameEn].some(name => name.toLowerCase() === city.toLowerCase()));
        return match?.id || createCustomTripDestination(country.code, city)!.id;
      }));
      if (!["", "ใช่", "ไม่", "yes", "no", "true", "false"].includes(flightText.toLowerCase())) throw new Error("มีเที่ยวบินต้องเป็น ใช่ หรือ ไม่");
      const parsed = rowSchema.parse({ name, outboundDate, returnDate, outboundTime: outboundTime || "09:00", returnTime: returnTime || "18:00", budget: Number(budget.replace(/,/g, "")), shoppingBudget: Number(shoppingBudget.replace(/,/g, "")), note });
      const totalDays = Math.round((Date.parse(returnDate) - Date.parse(outboundDate)) / 86400000) + 1;
      if (totalDays > 90) throw new Error("ทริปต้องไม่เกิน 90 วัน");
      const destination = formatTripDestination(destinations.map(item => item.nameTh).join(" · "), country.code, country.nameTh, destinations);
      if (destination.length > 160) throw new Error("ชื่อเมืองรวมกันยาวเกิน 160 ตัวอักษร กรุณาลดจำนวนเมืองหรือใช้ชื่อสั้นลง");
      trips.push({ ...parsed, code, row: index, countryCode: country.code, countryName: country.nameTh, timezone: country.timezone, destinations,
        destination, totalDays,
        hasFlights: ["ใช่", "yes", "true"].includes(flightText.toLowerCase()),
      });
    } catch (error) {
      const fields: Record<string, number> = { name: 1, outboundDate: 4, returnDate: 5, outboundTime: 6, returnTime: 7, budget: 8, shoppingBudget: 9, note: 11 };
      const describe = (column: number, message: string) => `ชีต ทริป แถว ${index} ช่อง ${cellAddress(column, index)} (${sheet.getCell(1, column).text}): ${message}`;
      if (error instanceof z.ZodError) error.issues.forEach(issue => errors.push(describe((fields[String(issue.path[0])] || 5) + offset, issue.message)));
      else {
        const message = error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง";
        const column = error instanceof ImportCellError ? error.column : message.includes("รหัสทริป") ? (codeFirst ? 1 : 12) : (message.includes("ประเทศ") ? 2 : message.includes("เมือง") ? 3 : message.includes("เที่ยวบิน") ? 10 : 5) + offset;
        errors.push(describe(column, message));
      }
    }
  }
  if (errors.length) throw new Error(errors.slice(0, 15).join("\n") + (errors.length > 15 ? `\nและอีก ${errors.length - 15} แถว` : ""));
  if (!trips.length) throw new Error("ยังไม่มีข้อมูลทริป กรุณากรอกข้อมูลในชีต ทริป");
  if (trips.length > 100) throw new Error("นำเข้าได้สูงสุด 100 ทริปต่อไฟล์");
  const plans: ImportedPlan[] = [];
  const tripMap = new Map(trips.filter(trip => trip.code).map(trip => [trip.code, trip]));
  const planMap = new Map<string, ImportedPlan>();
  const readRows = (name: string, headers: string[], limit: number, parse: (cells: string[], row: number) => void) => {
    const child = workbook.getWorksheet(name);
    if (!child) return;
    if (headers.some((header, index) => child.getCell(1, index + 1).text.trim() !== header)) { errors.push(`ชีต ${name}: หัวตารางไม่ตรงกับเทมเพลต`); return; }
    let dataRows = 0;
    for (let index = 2; index <= child.rowCount; index++) {
      const row = child.getRow(index);
      if (row.getCell(1).text.trim().toUpperCase() === IMPORT_EXAMPLE_CODE) continue;
      if (headers.every((_, column) => !row.getCell(column + 1).text.trim())) continue;
      if (++dataRows > limit) { errors.push(`ชีต ${name}: ไม่เกิน ${limit} แถวข้อมูลจริง (ไม่นับตัวอย่างและแถวว่าง)`); break; }
      try { parse(headers.map((header, column) => {
        try { return cellText(row.getCell(column + 1), header.startsWith("เวลา")); }
        catch (error) { throw new ImportCellError(column + 1, error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง"); }
      }), index); }
      catch (error) {
        const message = error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง";
        const hint = message.includes("รหัสทริป") ? "รหัสทริป" : message.includes("รหัสรายการ") ? "รหัสรายการ" : message.includes("วันที่") ? "วันที่" : message.includes("เวลา") ? "เวลา" : message.includes("จำนวนเงิน") || message.includes("ยอดเงินบาท") ? "จำนวนเงิน" : message.includes("สกุลเงิน") ? "สกุลเงิน" : message.includes("เรท") ? "เรทเป็นบาท" : message.includes("ประเภท") ? "ประเภท" : message.includes("ชื่อค่าใช้จ่าย") ? "ชื่อค่าใช้จ่าย" : message.includes("ชื่อรายการ") ? "ชื่อรายการ" : message.includes("เดินทาง") ? "วิธีเดินทาง" : message.includes("โลเคชั่น") ? "โลเคชั่นหรือที่อยู่" : message.includes("ชำระเงิน") ? "วิธีชำระเงิน" : "";
        const column = error instanceof ImportCellError ? error.column : headers.indexOf(hint) + 1;
        errors.push(`ชีต ${name} แถว ${index}${column ? ` ช่อง ${cellAddress(column, index)} (${headers[column - 1]})` : ""}: ${message}`);
      }
    }
  };
  const tripAndDay = (code: string, dateText: string) => {
    const trip = tripMap.get(code);
    if (!trip) throw new Error(`ไม่พบรหัสทริป ${code || "(ว่าง)"} ในชีต ทริป`);
    if (!date.safeParse(dateText).success || dateText < trip.outboundDate || dateText > trip.returnDate) throw new Error("วันที่ต้องอยู่ระหว่างวันเดินทางไปและกลับของทริป ใช้ ค.ศ. YYYY-MM-DD");
    return Math.round((Date.parse(dateText) - Date.parse(trip.outboundDate)) / 86400000) + 1;
  };
  readRows("ไทม์ไลน์", TIMELINE_HEADERS, 2000, (cells, row) => {
    const [tripText, codeText, dateText, time, name, address, transport, note] = cells;
    const tripCode = tripText.toUpperCase(), code = codeText.toUpperCase();
    const day = tripAndDay(tripCode, dateText);
    if (!/^[A-Z0-9_-]{1,40}$/.test(code)) throw new Error("กรอกรหัสรายการ เช่น PLAN01 (A-Z, 0-9, - หรือ _ ไม่เกิน 40 ตัว)");
    if (planMap.has(`${tripCode}:${code}`)) throw new Error(`รหัสรายการ ${code} ซ้ำในทริป ${tripCode}`);
    if (!name || name.length > 180) throw new Error("ชื่อรายการต้องมี 1–180 ตัวอักษร");
    if (address.length > 1000 || note.length > 1000) throw new Error("โลเคชั่นและรายละเอียดต้องไม่เกิน 1,000 ตัวอักษร");
    if (transport && !["เดิน", "รถไฟ", "รถยนต์", "รถบัส", "แท็กซี่", "เครื่องบิน", "เรือ"].includes(transport)) throw new Error("วิธีเดินทาง: เดิน, รถไฟ, รถยนต์, รถบัส, แท็กซี่, เครื่องบิน หรือ เรือ");
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("เวลาใช้ HH:mm หรือเว้นว่าง");
    if (time && plans.some(plan => plan.tripCode === tripCode && plan.day === day && plan.time === time)) throw new Error("วันและเวลาซ้ำกับรายการอื่นในทริป");
    const plan: ImportedPlan = { tripCode, code, day, date: dateText, time, name, address, transport, note, costs: [], row };
    plans.push(plan); planMap.set(`${tripCode}:${code}`, plan);
  });
  let expenseCount = 0;
  readRows("ค่าใช้จ่าย", EXPENSE_HEADERS, 5000, (cells, row) => {
    const [tripText, codeText, dateText, name, categoryText, amountText, currencyText, rateText, paymentText] = cells;
    const tripCode = tripText.toUpperCase(), code = codeText.toUpperCase();
    if (!tripMap.has(tripCode)) throw new Error(`ไม่พบรหัสทริป ${tripCode || "(ว่าง)"}`);
    let plan = code ? planMap.get(`${tripCode}:${code}`) : undefined;
    if (code && !plan) throw new Error(`ไม่พบรหัสรายการ ${code} ในทริป ${tripCode}`);
    const spentAt = dateText || plan?.date || "";
    const day = tripAndDay(tripCode, spentAt);
    if (plan && plan.date !== spentAt) throw new Error("วันที่ค่าใช้จ่ายไม่ตรงกับรายการไทม์ไลน์ ให้เว้นวันที่หรือแก้ให้ตรงกัน");
    if (!name || name.length > 100) throw new Error("ชื่อค่าใช้จ่ายต้องมี 1–100 ตัวอักษร");
    const category = IMPORT_CATEGORIES.find(value => value.toLowerCase() === (categoryText || "อื่น ๆ").toLowerCase());
    if (!category) throw new Error("เลือกประเภทค่าใช้จ่ายจากรายการในเทมเพลต");
    const currency = (currencyText || "THB").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency) || !Intl.supportedValuesOf("currency").includes(currency)) throw new Error("สกุลเงินต้องเป็นรหัส เช่น THB, JPY, VND, USD");
    const amount = Number(amountText.replace(/,/g, ""));
    const rate = rateText ? Number(rateText.replace(/,/g, "")) : currency === "THB" ? 1 : NaN;
    if (!amountText || !Number.isFinite(amount) || amount < 0 || amount > 999999999) throw new Error("กรอกจำนวนเงินตั้งแต่ 0 ถึง 999,999,999");
    if (!Number.isFinite(rate) || rate <= 0 || rate > 999999 || (currency === "THB" && rate !== 1)) throw new Error("กรอกเรทเป็นบาทที่มากกว่า 0; ถ้า THB ใช้เรท 1");
    const value = Math.round(amount * rate * 100) / 100;
    if (value > 999999999) throw new Error("ยอดเงินบาทเกิน 999,999,999");
    if (paymentText.length > 60) throw new Error("วิธีชำระเงินไม่เกิน 60 ตัวอักษร");
    if (!plan) {
      let bucket = 1;
      while ((planMap.get(`${tripCode}:@expenses-${spentAt}-${bucket}`)?.costs.length || 0) >= 30) bucket++;
      const key = `${tripCode}:@expenses-${spentAt}-${bucket}`;
      plan = planMap.get(key);
      if (!plan) {
        plan = { tripCode, code: `@expenses-${spentAt}-${bucket}`, day, date: spentAt, time: "", name: `ค่าใช้จ่ายวันที่ ${spentAt}${bucket > 1 ? ` (${bucket})` : ""}`, address: "", transport: "", note: "นำเข้าค่าใช้จ่ายรายวันจาก Excel", costs: [], row };
        plans.push(plan); planMap.set(key, plan);
      }
    }
    if (plan.costs.length >= 30) throw new Error("ค่าใช้จ่ายเกิน 30 รายการต่อจุด กรุณาแยกรหัสรายการไทม์ไลน์เพิ่ม");
    plan.costs.push({ key: name, value, category, currency, foreignAmount: amount, exchangeRate: rate, rateDate: spentAt, paymentMethod: paymentText || "เงินสด" });
    expenseCount++;
  });
  // Reserve explicit times first, then fill unknown times without collisions.
  for (const plan of plans.filter(plan => !plan.time)) {
    const used = new Set(plans.filter(other => other.tripCode === plan.tripCode && other.day === plan.day).map(other => other.time));
    for (let offset = 0; offset < 1440; offset++) {
      const minute = (540 + offset) % 1440;
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      if (!used.has(time)) { plan.time = time; break; }
    }
    if (!plan.time) errors.push(`ชีต ไทม์ไลน์: จำนวนรายการต่อวันมากเกินไป (${plan.tripCode} ${plan.date})`);
  }
  const stays: ImportedStay[] = [], flights: ImportedFlight[] = [];
  readRows("ที่พัก", STAY_HEADERS, 500, (cells, row) => { stays.push(parseImportedStay(cells, row, tripMap.get(cells[0].toUpperCase()))); });
  readRows("เที่ยวบิน", FLIGHT_HEADERS, 500, (cells, row) => {
    const flight = parseImportedFlight(cells, row, tripMap.get(cells[0].toUpperCase()));
    if (flights.some(other => other.tripCode === flight.tripCode && other.journey === flight.journey && other.order === flight.order)) throw new ImportCellError(3, "ลำดับช่วงบินซ้ำในขาเที่ยวบินนี้");
    flights.push(flight);
  });
  for (const flight of flights) {
    const previous = flights.filter(other => other.tripCode === flight.tripCode && other.journey === flight.journey && other.order < flight.order).sort((a, b) => b.order - a.order)[0];
    if (flight.journey !== "internal" && previous && (previous.arrivalCode !== flight.departureCode || previous.arrivalAt > flight.departureAt)) errors.push(`ชีต เที่ยวบิน แถว ${flight.row} ช่อง F${flight.row} (สนามบินต้นทาง) / I${flight.row} (เวลาออก): ต่อเครื่องต้องออกจากสนามบินที่ช่วงก่อนหน้ามาถึง และเวลาต้องไม่ย้อนกัน`);
  }
  if (errors.length) throw new Error(errors.slice(0, 30).join("\n\n") + (errors.length > 30 ? `\nและอีก ${errors.length - 30} แถว` : ""));
  if (plans.length + stays.reduce((sum, stay) => sum + stay.checkOutDay - stay.checkInDay, 0) + flights.length > 2000) throw new Error("รวมไทม์ไลน์ คืนที่พัก เที่ยวบิน และรายการค่าใช้จ่ายรายวันต้องไม่เกิน 2,000 รายการ กรุณาแบ่งไฟล์");
  return { trips, plans, expenseCount, stays, flights };
}
