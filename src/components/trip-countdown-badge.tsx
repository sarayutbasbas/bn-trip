import { PlaneTakeoff } from "lucide-react";

export function TripCountdownBadge({ label, tone = "upcoming" }: { label: string; tone?: "upcoming" | "past" }) {
  return <span className={`trip-countdown-badge${tone === "past" ? " is-past" : ""}`}><PlaneTakeoff size={11} aria-hidden="true" /><span>{label}</span></span>;
}
