import ExcelJS from "exceljs";

export type ExportTrip = {
  name: string;
  destination: string;
  start_date: string;
  total_days: number;
  has_day_zero?: boolean;
};

export type ExportCostItem = {
  id?: string;
  key: string;
  value: number;
  category?: string;
  currency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
  rateDate?: string;
  paymentMethod?: string;
  creditCardId?: string;
  paymentOwnerName?: string;
  splitMemberIds?: string[];
  splitGuestIds?: string[];
  splitCount?: number;
};

export type ExportItinerary = {
  id: string;
  day_number: number;
  time_slot: "morning" | "afternoon" | "evening";
  start_time: string | null;
  place_name: string;
  address: string | null;
  transport_mode: string | null;
  transport_note: string | null;
  cost_items: ExportCostItem[];
  accommodation_id?: string | null;
  accommodation_night?: number | null;
  accommodation_nights?: number | null;
  documents?: Array<{ title: string; original_filename: string }>;
};

type ExportPerson = { id: string; name: string };
type ExportCard = {
  id: string;
  nickname: string;
  brand: string | null;
  last_four: string | null;
  owner_name: string;
};

const ORANGE = "FFFF6712";
const DARK_ORANGE = "FFC2410C";
const LIGHT_ORANGE = "FFFFF1E8";
const WHITE = "FFFFFFFF";
const INK = "FF242429";
const MUTED = "FF66666D";
const LINE = "FFE2E2E7";

function addDays(dateValue: string, amount: number) {
  const [year, month, day] = dateValue.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount));
}

function displayDay(trip: ExportTrip, storedDay: number) {
  return storedDay - Number(Boolean(trip.has_day_zero));
}

function timeSlotLabel(slot: ExportItinerary["time_slot"]) {
  return { morning: "เช้า", afternoon: "บ่าย", evening: "เย็น" }[slot];
}

function paymentLabel(value?: string) {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("cash") || normalized.includes("เงินสด")) return "เงินสด";
  if (normalized.includes("transfer") || normalized.includes("โอน")) return "โอนเงิน";
  if (normalized.includes("debit") || normalized.includes("เดบิต")) return "บัตรเดบิต";
  if (normalized.includes("credit") || normalized.includes("เครดิต")) return "บัตรเครดิต";
  return value || "ไม่ระบุ";
}

function setupSheet(
  sheet: ExcelJS.Worksheet,
  trip: ExportTrip,
  title: string,
  columns: Array<{ header: string; key: string; width: number }>,
) {
  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 31;

  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell(2, 1).value = `${trip.name} · ${trip.destination}`;
  sheet.getCell(2, 1).font = { bold: true, size: 12, color: { argb: INK } };
  sheet.getCell(2, 1).alignment = { vertical: "middle" };

  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell(3, 1).value = `ช่วงเดินทาง ${trip.start_date.slice(0, 10)} · ${trip.total_days} วัน`;
  sheet.getCell(3, 1).font = { size: 10, color: { argb: MUTED } };
  sheet.getCell(3, 1).alignment = { vertical: "middle" };

  sheet.columns = columns.map(({ key, width }) => ({ key, width }));
  const header = sheet.getRow(5);
  header.values = columns.map((column) => column.header);
  header.height = 25;
  header.font = { bold: true, color: { argb: WHITE }, size: 10 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_ORANGE } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: ORANGE } },
    };
  });
  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: columns.length } };
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
}

function styleDataRows(sheet: ExcelJS.Worksheet, startRow: number, dayColumn = 1) {
  let previousDay: unknown;
  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.getCell(5).value === "รวมทั้งหมด") continue;
    const day = row.getCell(dayColumn).value;
    row.alignment = { vertical: "top", wrapText: true };
    row.font = { size: 10, color: { argb: INK } };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
    });
    if (day !== previousDay) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_ORANGE } };
        cell.border = { top: { style: "thin", color: { argb: ORANGE } } };
      });
      previousDay = day;
    }
  }
}

export async function buildTripPlanWorkbook(input: {
  trip: ExportTrip;
  itineraries: ExportItinerary[];
  members: ExportPerson[];
  guests: ExportPerson[];
  cards: ExportCard[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RouteRao";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `แผนเที่ยวและค่าใช้จ่าย ${input.trip.name}`;

  const memberNames = new Map(input.members.map((person) => [person.id, person.name]));
  const guestNames = new Map(input.guests.map((person) => [person.id, person.name]));
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  const sortedItems = [...input.itineraries].sort(
    (left, right) =>
      left.day_number - right.day_number ||
      (left.start_time || "99:99").localeCompare(right.start_time || "99:99") ||
      left.place_name.localeCompare(right.place_name, "th"),
  );

  const timeline = workbook.addWorksheet("แผนการเดินทาง", {
    properties: { tabColor: { argb: ORANGE } },
  });
  const timelineColumns = [
    { header: "วันที่ในทริป", key: "day", width: 13 },
    { header: "วันที่", key: "date", width: 13 },
    { header: "เวลา", key: "time", width: 10 },
    { header: "ช่วงเวลา", key: "slot", width: 11 },
    { header: "ประเภท", key: "type", width: 13 },
    { header: "สถานที่ / รายการ", key: "place", width: 28 },
    { header: "ที่อยู่", key: "address", width: 32 },
    { header: "วิธีเดินทาง", key: "transport", width: 16 },
    { header: "รายละเอียด", key: "note", width: 38 },
    { header: "ค่าใช้จ่าย (THB)", key: "cost", width: 17 },
    { header: "ไฟล์แนบ", key: "documents", width: 28 },
  ];
  setupSheet(timeline, input.trip, "แผนการเดินทาง", timelineColumns);
  if (sortedItems.length) {
    for (const item of sortedItems) {
      timeline.addRow({
        day: `Day ${displayDay(input.trip, item.day_number)}`,
        date: addDays(input.trip.start_date, item.day_number - 1),
        time: item.start_time?.slice(0, 5) || "ไม่ระบุ",
        slot: timeSlotLabel(item.time_slot),
        type: item.accommodation_id ? "ที่พัก" : "แผนเที่ยว",
        place: item.place_name,
        address: item.address || "",
        transport: item.transport_mode || "",
        note: item.transport_note || "",
        cost: (item.cost_items || []).reduce((sum, cost) => sum + Number(cost.value || 0), 0),
        documents: (item.documents || []).map((document) => document.title || document.original_filename).join("\n"),
      });
    }
  } else {
    timeline.addRow({ place: "ยังไม่มีรายการใน Timeline" });
  }
  timeline.getColumn("date").numFmt = "yyyy-mm-dd";
  timeline.getColumn("cost").numFmt = '#,##0.00" ฿"';
  styleDataRows(timeline, 6);

  const expenses = workbook.addWorksheet("ค่าใช้จ่าย", {
    properties: { tabColor: { argb: DARK_ORANGE } },
  });
  const expenseColumns = [
    { header: "วันที่ในทริป", key: "day", width: 13 },
    { header: "วันที่", key: "date", width: 13 },
    { header: "เวลา", key: "time", width: 10 },
    { header: "Timeline", key: "place", width: 27 },
    { header: "รายการค่าใช้จ่าย", key: "expense", width: 27 },
    { header: "หมวดหมู่", key: "category", width: 17 },
    { header: "ยอดสกุลเงินต้นทาง", key: "foreignAmount", width: 20 },
    { header: "สกุลเงิน", key: "currency", width: 11 },
    { header: "อัตราแลกเปลี่ยน", key: "exchangeRate", width: 17 },
    { header: "ยอดรวม (THB)", key: "value", width: 17 },
    { header: "วันที่เรต", key: "rateDate", width: 13 },
    { header: "ช่องทางชำระ", key: "payment", width: 18 },
    { header: "บัตร", key: "card", width: 24 },
    { header: "ผู้จ่าย", key: "owner", width: 20 },
    { header: "หารกับ", key: "split", width: 30 },
  ];
  setupSheet(expenses, input.trip, "รายการค่าใช้จ่ายทั้งหมด", expenseColumns);
  for (const item of sortedItems) {
    for (const cost of item.cost_items || []) {
      const card = cost.creditCardId ? cards.get(cost.creditCardId) : undefined;
      const splitNames = [
        ...(cost.splitMemberIds || []).map((id) => memberNames.get(id) || id),
        ...(cost.splitGuestIds || []).map((id) => guestNames.get(id) || id),
      ];
      expenses.addRow({
        day: `Day ${displayDay(input.trip, item.day_number)}`,
        date: addDays(input.trip.start_date, item.day_number - 1),
        time: item.start_time?.slice(0, 5) || "ไม่ระบุ",
        place: item.place_name,
        expense: cost.key,
        category: cost.category || "อื่น ๆ",
        foreignAmount: cost.foreignAmount ?? (cost.currency === "THB" ? cost.value : null),
        currency: cost.currency || "THB",
        exchangeRate: cost.exchangeRate ?? (cost.currency === "THB" || !cost.currency ? 1 : null),
        value: Number(cost.value || 0),
        rateDate: cost.rateDate ? new Date(`${cost.rateDate.slice(0, 10)}T00:00:00Z`) : null,
        payment: paymentLabel(cost.paymentMethod),
        card: card
          ? `${card.nickname}${card.last_four ? ` •••• ${card.last_four}` : ""}`
          : "",
        owner: cost.paymentOwnerName || card?.owner_name || "",
        split: splitNames.length
          ? splitNames.join(", ")
          : cost.splitCount
            ? `${cost.splitCount} คน`
            : "",
      });
    }
  }
  if (expenses.rowCount === 5) expenses.addRow({ expense: "ยังไม่มีค่าใช้จ่าย" });
  else {
    const totalRow = expenses.addRow({ expense: "รวมทั้งหมด" });
    totalRow.getCell("value").value = { formula: `SUM(J6:J${totalRow.number - 1})` };
    totalRow.font = { bold: true, color: { argb: WHITE } };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  }
  expenses.getColumn("date").numFmt = "yyyy-mm-dd";
  expenses.getColumn("foreignAmount").numFmt = "#,##0.00";
  expenses.getColumn("exchangeRate").numFmt = "0.000000";
  expenses.getColumn("value").numFmt = '#,##0.00" ฿"';
  expenses.getColumn("rateDate").numFmt = "yyyy-mm-dd";
  styleDataRows(expenses, 6);

  return workbook.xlsx.writeBuffer();
}
