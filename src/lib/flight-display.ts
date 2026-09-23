type FlightTimeSource = {
  scheduledDepartureAt: string;
  scheduledArrivalAt: string;
  enteredDepartureLocalText?: string | null;
  enteredArrivalLocalText?: string | null;
  latestDepartureAt?: string | null;
  latestArrivalAt?: string | null;
};

export function flightDurationLabel(source: FlightTimeSource) {
  const hasEnteredTimes = Boolean(
    source.enteredDepartureLocalText && source.enteredArrivalLocalText,
  );
  const departure = hasEnteredTimes
    ? source.enteredDepartureLocalText!
    : source.latestDepartureAt || source.scheduledDepartureAt;
  const arrival = hasEnteredTimes
    ? source.enteredArrivalLocalText!
    : source.latestArrivalAt || source.scheduledArrivalAt;
  const totalMinutes = Math.round(
    (new Date(arrival).getTime() - new Date(departure).getTime()) / 60_000,
  );
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "";
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return [
    days ? `${days} วัน` : "",
    hours ? `${hours} ชม.` : "",
    minutes ? `${minutes} นาที` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
