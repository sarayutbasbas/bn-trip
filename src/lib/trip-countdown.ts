/** Compact remaining time: approximate 30-day months; omit days once years are shown. */
export function tripDaysUntilLabel(daysUntil: number) {
  const days = Math.max(0, Math.floor(daysUntil));
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  if (days < 30) return `อีก ${days} วัน`;
  const years = Math.floor(days / 365);
  const months = Math.min(11, Math.floor((days % 365) / 30));
  if (!years) {
    const remainingDays = days % 30;
    return remainingDays
      ? `อีก ${months} เดือน ${remainingDays} วัน`
      : `อีก ${months} เดือน`;
  }
  return months ? `อีก ${years} ปี ${months} เดือน` : `อีก ${years} ปี`;
}
