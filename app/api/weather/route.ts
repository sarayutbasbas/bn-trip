import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

type GeoResult = { name: string; country?: string; latitude: number; longitude: number };
type ForecastResult = {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: { time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[]; weather_code?: number[] };
};
type DailyResult = { time?: string[]; temperature_2m_min?: number[]; temperature_2m_max?: number[]; weather_code?: number[] };

function addYears(date: string, years: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year + years, month - 1, day));
  return result.toISOString().slice(0, 10);
}

function makeHistoricalNormals(data: DailyResult, requestedDates: string[]) {
  const byMonthDay = new Map<string, Array<{ minimum: number; maximum: number; code: number }>>();
  for (let index = 0; index < (data.time?.length || 0); index++) {
    const date = data.time![index];
    const minimum = data.temperature_2m_min?.[index];
    const maximum = data.temperature_2m_max?.[index];
    const code = data.weather_code?.[index];
    if (typeof minimum !== "number" || typeof maximum !== "number" || typeof code !== "number") continue;
    const key = date.slice(5);
    byMonthDay.set(key, [...(byMonthDay.get(key) || []), { minimum, maximum, code }]);
  }
  return requestedDates.flatMap(date => {
    const key = date.slice(5);
    let samples = byMonthDay.get(key) || [];
    if (!samples.length && key === "02-29") samples = [...(byMonthDay.get("02-28") || []), ...(byMonthDay.get("03-01") || [])];
    if (!samples.length) return [];
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const codes = new Map<number, number>();
    samples.forEach(sample => codes.set(sample.code, (codes.get(sample.code) || 0) + 1));
    const code = [...codes].sort((a, b) => b[1] - a[1])[0][0];
    return [{ date, minimum: mean(samples.map(sample => sample.minimum)), maximum: mean(samples.map(sample => sample.maximum)), code, approximate: true }];
  });
}

export async function GET(request: Request) {
  if (!await getSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const location = (params.get("location") || "").trim().slice(0, 120);
  const countryCode = (params.get("country") || "").trim().toUpperCase();
  const requestedDates = [...new Set((params.get("dates") || "").split(",").filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].slice(0, 180);
  if (!location) return NextResponse.json({ error: "กรุณาระบุเมือง" }, { status: 400 });

  try {
    const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geoUrl.searchParams.set("name", location);
    geoUrl.searchParams.set("count", "1");
    geoUrl.searchParams.set("language", "en");
    geoUrl.searchParams.set("format", "json");
    if (/^[A-Z]{2}$/.test(countryCode)) geoUrl.searchParams.set("countryCode", countryCode);
    const geoResponse = await fetch(geoUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!geoResponse.ok) throw new Error("Geocoding unavailable");
    const geo = await geoResponse.json() as { results?: GeoResult[] };
    const city = geo.results?.[0];
    if (!city) return NextResponse.json({ error: "ไม่พบข้อมูลเมือง" }, { status: 404 });

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(city.latitude));
    forecastUrl.searchParams.set("longitude", String(city.longitude));
    forecastUrl.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,weather_code");
    forecastUrl.searchParams.set("current", "temperature_2m,weather_code");
    forecastUrl.searchParams.set("forecast_days", "16");
    forecastUrl.searchParams.set("temperature_unit", "celsius");
    const forecastResponse = await fetch(forecastUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!forecastResponse.ok) throw new Error("Forecast unavailable");
    const forecast = await forecastResponse.json() as ForecastResult;
    const daily = forecast.daily;
    const currentTemperature = forecast.current?.temperature_2m;
    const currentCode = forecast.current?.weather_code;
    if (typeof currentTemperature !== "number" || typeof currentCode !== "number" || !daily?.time?.length || !daily.temperature_2m_min || !daily.temperature_2m_max || !daily.weather_code) throw new Error("Forecast unavailable");
    const forecastDays = daily.time.flatMap((date, index) => {
      const minimum = daily.temperature_2m_min?.[index];
      const maximum = daily.temperature_2m_max?.[index];
      const code = daily.weather_code?.[index];
      return typeof minimum === "number" && typeof maximum === "number" && typeof code === "number" ? [{ date, minimum, maximum, code, approximate: false }] : [];
    });
    const forecastDateSet = new Set(forecastDays.map(day => day.date));
    const missingDates = requestedDates.filter(date => !forecastDateSet.has(date));
    let historicalDays: ReturnType<typeof makeHistoricalNormals> = [];
    if (missingDates.length) {
      const startDate = addYears([...missingDates].sort()[0], -1);
      const endDate = addYears([...missingDates].sort().at(-1)!, -1);
      const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
      archiveUrl.searchParams.set("latitude", String(city.latitude));
      archiveUrl.searchParams.set("longitude", String(city.longitude));
      archiveUrl.searchParams.set("start_date", startDate);
      archiveUrl.searchParams.set("end_date", endDate);
      archiveUrl.searchParams.set("daily", "temperature_2m_min,temperature_2m_max,weather_code");
      archiveUrl.searchParams.set("timezone", "auto");
      try {
        const archiveResponse = await fetch(archiveUrl, { cache: "no-store", signal: AbortSignal.timeout(7000) });
        if (archiveResponse.ok) {
          const archive = await archiveResponse.json() as { daily?: DailyResult };
          historicalDays = makeHistoricalNormals(archive.daily || {}, missingDates);
        }
      } catch { /* historical estimates are optional; current temperature remains available */ }
    }
    const days = [...forecastDays, ...historicalDays];
    return NextResponse.json({ days, current: { temperature: currentTemperature, code: currentCode }, city: city.name, country: city.country || "" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "โหลดอุณหภูมิไม่สำเร็จ" }, { status: 502 });
  }
}
