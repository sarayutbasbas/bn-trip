import type { TripIdea } from "@/src/lib/trip-ideas";

export function ideaCountdown(idea: TripIdea, now = new Date()) {
  if (idea.kind !== "planned" || !idea.target_year || !idea.target_month) return null;
  const months = (idea.target_year - now.getFullYear()) * 12 +
    (idea.target_month - (now.getMonth() + 1));
  if (months < 0) return "เลยกำหนดแล้ว";
  if (months === 0) return "เดือนนี้";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (!years) return `อีก ${remainingMonths} เดือน`;
  return remainingMonths
    ? `อีก ${years} ปี ${remainingMonths} เดือน`
    : `อีก ${years} ปี`;
}

export function ideaTargetDate(idea: TripIdea) {
  if (idea.kind !== "planned" || !idea.target_year || !idea.target_month) return null;
  return new Date(idea.target_year, idea.target_month - 1, 1)
    .toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
}
