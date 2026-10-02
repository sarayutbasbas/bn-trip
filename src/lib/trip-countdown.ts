/** Compact remaining time: approximate months, with days only below 30. */
export function tripDaysUntilLabel(daysUntil: number) {
  const days = Math.max(0, Math.floor(daysUntil));
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  if (days < 30) return `อีก ${days} วัน`;
  const years = Math.floor(days / 365);
  const months = Math.min(11, Math.floor((days % 365) / 30));
  if (!years) return `อีก ${months} เดือน`;
  return months ? `อีก ${years} ปี ${months} เดือน` : `อีก ${years} ปี`;
}
