const THAI_WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const ENGLISH_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function tripWeekdayLabel(dateValue: string, day: number, language: "TH" | "EN" = "TH") {
  const [year, month, date] = dateValue.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date || !Number.isInteger(day)) return "";
  const weekday = new Date(Date.UTC(year, month - 1, date + day - 1)).getUTCDay();
  return (language === "EN" ? ENGLISH_WEEKDAYS : THAI_WEEKDAYS)[weekday];
}
