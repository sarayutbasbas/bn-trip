export function bangkokDate(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function accommodationPaymentStatus(date: string | null | undefined, legacy: "paid" | "pending" | null | undefined, today = bangkokDate()) {
  return date ? (date.slice(0, 10) <= today ? "paid" : "pending") : legacy;
}
