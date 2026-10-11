export function filterDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function flightFilter(value: string | null | undefined): "all" | "true" | "false" {
  return value === "true" || value === "false" ? value : "all";
}

// Inclusive overlap: a trip that spans either boundary belongs in the range.
export function appendTripRangeFilter(where: string[], values: Array<string | number | number[] | string[]>, params: URLSearchParams) {
  const from = filterDate(params.get("from")), to = filterDate(params.get("to"));
  if (from && to && from > to) where.push("FALSE");
  if (from) {
    values.push(from);
    where.push(`COALESCE(t.return_departure_at::date,t.start_date+t.total_days-1)>=$${values.length}::date`);
  }
  if (to) {
    values.push(to);
    where.push(`t.start_date<=$${values.length}::date`);
  }
  const flights = flightFilter(params.get("flights"));
  if (flights === "true") where.push("t.has_flights IS TRUE");
  if (flights === "false") where.push("t.has_flights IS NOT TRUE");
}
