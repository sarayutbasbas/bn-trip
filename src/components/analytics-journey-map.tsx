"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, MapPin, Plane } from "lucide-react";
import type { TravelAnalyticsPayload, TravelAnalyticsScope } from "@/src/lib/trip-loaders";
import { countryByCode } from "@/src/lib/countries";

type Feature = { properties: { shapeName?: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
const nameKey = (name: string) => name.toLowerCase().replace(/\b(province|prefecture|metropolis|metropolitan|changwat)\b/g, "").replace(/[^a-z0-9]/g, "");
const countryAliases: Record<string, string> = { US: "United States of America", KR: "South Korea", GB: "United Kingdom", AE: "United Arab Emirates", CZ: "Czechia", CI: "Ivory Coast", CD: "Democratic Republic of the Congo", CG: "Republic of the Congo" };

export function AnalyticsJourneyMap({ data, scope, english }: { data: TravelAnalyticsPayload; scope: TravelAnalyticsScope; english: boolean }) {
  const domestic = scope === "domestic";
  const [features, setFeatures] = useState<Feature[]>([]);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(domestic ? "/maps/thailand-adm1.geojson" : "/maps/world-countries.geojson")
      .then(response => { if (!response.ok) throw new Error("map unavailable"); return response.json(); })
      .then(body => { if (active) setFeatures(body.features); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [domestic]);
  const visits = useMemo(() => {
    const entries = domestic
      ? data.destinations.map(item => ({ key: nameKey(item.nameEn), label: english ? item.nameEn : item.nameTh, trips: item.trips }))
      : data.countries.map(item => ({ key: nameKey(countryAliases[item.countryCode] || countryByCode(item.countryCode)?.nameEn || item.country), label: item.country, trips: item.trips }));
    return new Map(entries.map(item => [item.key, item]));
  }, [data, domestic, english]);
  const chart = useMemo(() => {
    const visible = features.filter(feature => feature.properties.shapeName !== "Antarctica");
    const polygons = visible.map(feature => ({ feature, rings: feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as number[][][]] : feature.geometry.coordinates as number[][][][] }));
    const points = polygons.flatMap(item => item.rings.flat(2));
    if (!points.length) return [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const width = domestic ? 320 : 800, height = domestic ? 440 : 380;
    const scale = Math.min((width - 24) / (maxX - minX), (height - 24) / (maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxY - minY) * scale) / 2;
    return polygons.map(({ feature, rings }) => ({
      name: feature.properties.shapeName || "",
      d: rings.map(polygon => polygon.map(ring => `M${ring.map(([x,y]) => `${(offsetX + (x-minX)*scale).toFixed(2)},${(offsetY + (maxY-y)*scale).toFixed(2)}`).join("L")}Z`).join(" ")).join(" "),
    }));
  }, [features, domestic]);
  const title = domestic ? (english ? "Our journeys across Thailand" : "เก็บความทรงจำทั่วไทย") : scope === "international" ? (english ? "Our journeys around the world" : "ออกไปค้นพบโลกกว้าง") : (english ? "Every journey on one map" : "ทุกเส้นทางในแผนที่เดียว");
  const Icon = domestic ? MapPin : scope === "international" ? Plane : Globe2;
  const selectedVisit = selected ? visits.get(nameKey(selected)) : null;
  return <section className={`analytics-journey-map analytics-geography is-${scope}`}>
    <div className="analytics-memory-section-head"><h2><Icon size={18} />{title}</h2></div>
    <div className="analytics-geography-layout">
      <div className="analytics-geography-art">
        {!chart.length ? <p role="status">{failed ? (english ? "Map unavailable" : "โหลดแผนที่ไม่สำเร็จ") : (english ? "Loading map…" : "กำลังเตรียมแผนที่…")}</p> : <svg viewBox={domestic ? "0 0 320 440" : "0 0 800 380"} aria-label={domestic ? "Thailand travel map" : "World travel map"}>
          {chart.map(item => {
            const visit = visits.get(nameKey(item.name));
            const label = visit ? `${visit.label} · ${visit.trips} ${english ? "trips" : "ทริป"}` : item.name;
            return <path key={item.name} d={item.d} className={visit ? "is-visited" : ""} role={visit ? "button" : undefined} tabIndex={visit ? 0 : undefined} aria-label={label}
              onClick={() => { if (visit) setSelected(item.name); }}
              onKeyDown={event => { if (visit && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelected(item.name); } }}><title>{label}</title></path>;
          })}
        </svg>}
      </div>
      <div className="analytics-geography-copy">
        <Icon size={24} />
        <strong>{domestic ? data.totals.destinations : data.totals.countries}<small>{domestic ? (english ? "destinations in Thailand" : "จุดหมายในประเทศไทย") : (english ? "countries visited" : "ประเทศที่เคยไป")}</small></strong>
        <p>{domestic ? (english ? "Nearby or far away, every province tells a story." : "ใกล้หรือไกล ทุกจังหวัดมีเรื่องราว") : (english ? "Across borders, collecting new memories." : "ข้ามพรมแดน เก็บประสบการณ์ใหม่")}</p>
        <span>{data.totals.trips} {english ? "trips" : "ทริป"} · {data.totals.destinations} {english ? "destinations" : "จุดหมาย"}</span>
      </div>
    </div>
    <div className="analytics-geography-legend"><i />{english ? "Visited" : "ไปมาแล้ว"}<small>{english ? "Tap a coloured area for details" : "แตะพื้นที่สีเพื่อดูจำนวนทริป"}</small></div>
    {selectedVisit ? <p className="analytics-geography-selection" role="status">{selectedVisit.label} · {selectedVisit.trips} {english ? "trips" : "ทริป"}</p> : null}
  </section>;
}
