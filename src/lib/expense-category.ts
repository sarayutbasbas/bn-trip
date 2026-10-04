export function expenseCategoryTone(category?: string | null) {
  const normalized = (category || "อื่น ๆ").trim().toLocaleLowerCase();
  let tone = "other";
  if (
    normalized.includes("อาหาร") ||
    normalized.includes("กิน") ||
    normalized.includes("food")
  ) {
    tone = "food";
  } else if (
    normalized.includes("เดินทาง") ||
    normalized.includes("transport")
  ) {
    tone = "transport";
  } else if (normalized.includes("ที่พัก") || normalized.includes("hotel")) {
    tone = "stay";
  } else if (
    normalized.includes("เครื่องบิน") ||
    normalized.includes("flight")
  ) {
    tone = "flight";
  } else if (
    normalized.includes("กิจกรรม") ||
    normalized.includes("ticket")
  ) {
    tone = "activity";
  } else if (
    normalized.includes("shopping") ||
    normalized.includes("ช้อป") ||
    normalized.includes("ของฝาก")
  ) {
    tone = "shopping";
  }
  return tone;
}

const colors: Record<string, string> = { food: "#d95718", transport: "#087f69", stay: "#ce3553", flight: "#4269cf", activity: "#7c3dc8", shopping: "#a97000", other: "#64748b" };
export function expenseCategoryColor(category?: string | null) { return colors[expenseCategoryTone(category)]; }

