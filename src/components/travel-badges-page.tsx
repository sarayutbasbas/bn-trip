"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeft,
  Download,
  CheckCircle2,
  Flame,
  Globe2,
  Grid2X2,
  LockKeyhole,
  Map as MapIcon,
  MapPinCheck,
  Maximize2,
  Trophy,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  TravelBadge,
  TravelBadgeCategory,
  TravelBadgeCollection,
} from "@/src/lib/travel-badges";
import { exportTravelMap } from "@/src/lib/export-travel-map";
type BadgeFilter = "all" | TravelBadgeCategory;

const CATEGORY_META: Record<TravelBadgeCategory, { label: string; eyebrow: string }> = {
  thailand: { label: "ไทย", eyebrow: "77 PROVINCES" },
  japan: { label: "ญี่ปุ่น", eyebrow: "47 PREFECTURES" },
  international: { label: "นานาชาติ", eyebrow: "SUPPORTED COUNTRIES" },
};

type MapGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type MapFeature = { properties: { shapeName?: string; shapeISO?: string }; geometry: MapGeometry };
type MapCollection = { features: MapFeature[] };
type MapViewport = { zoom: number; centerX: number; centerY: number };

const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 4;

function geometryRings(geometry: MapGeometry): number[][][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][];
}

function normalizedMapName(value: string) {
  return value.toLowerCase().replace(/province|prefecture|metropolis|fu|to|do|ken/gi, "").replace(/[^a-z0-9]/g, "");
}

function normalizedViewport(viewport: MapViewport, width: number, height: number): MapViewport {
  const zoom = Number.isFinite(viewport.zoom)
    ? Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, viewport.zoom))
    : MIN_MAP_ZOOM;
  const viewWidth = width / zoom;
  const viewHeight = height / zoom;
  const clampCenter = (center: number, size: number, viewSize: number) => {
    const fallback = size / 2;
    const safeCenter = Number.isFinite(center) ? center : fallback;
    return Math.min(size - viewSize / 2, Math.max(viewSize / 2, safeCenter));
  };
  return {
    zoom,
    centerX: clampCenter(viewport.centerX, width, viewWidth),
    centerY: clampCenter(viewport.centerY, height, viewHeight),
  };
}

function AdministrativeMap({
  category,
  badges,
  selectedId,
  selectBadge,
}: {
  category: BadgeFilter;
  badges: TravelBadge[];
  selectedId?: string;
  selectBadge: (id: string) => void;
}) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const isWorld = category === "all" || category === "international";
  const mapWidth = category === "thailand" ? 520 : 900;
  const mapHeight = isWorld ? 450 : category === "thailand" ? 720 : 620;
  const [viewport, setViewport] = useState<MapViewport>({ zoom: MIN_MAP_ZOOM, centerX: mapWidth / 2, centerY: mapHeight / 2 });
  const drag = useRef<{ pointerX: number; pointerY: number; centerX: number; centerY: number } | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    let active = true;
    fetch(isWorld ? "/maps/world-countries.geojson" : `/maps/${category === "thailand" ? "thailand" : "japan"}-adm1.geojson`)
      .then((response) => response.json() as Promise<MapCollection>)
      .then((collection) => { if (active) setFeatures(collection.features); })
      .catch(() => { if (active) setFeatures([]); });
    return () => { active = false; };
  }, [category, isWorld]);

  const projected = useMemo(() => {
    const width = mapWidth;
    const height = mapHeight;
    const coordinates = features.flatMap((feature) => geometryRings(feature.geometry).flat(2));
    if (!coordinates.length) return { width, height, markers: [] as Array<{ badge: TravelBadge; x: number; y: number }>, paths: [] as Array<{ feature: MapFeature; path: string }> };
    let minLng = Infinity; let maxLng = -Infinity;
    let minLat = Infinity; let maxLat = -Infinity;
    for (const point of coordinates) {
      minLng = Math.min(minLng, point[0]); maxLng = Math.max(maxLng, point[0]);
      minLat = Math.min(minLat, point[1]); maxLat = Math.max(maxLat, point[1]);
    }
    const padding = 26;
    const scale = Math.min((width - padding * 2) / (maxLng - minLng), (height - padding * 2) / (maxLat - minLat));
    const contentWidth = (maxLng - minLng) * scale;
    const contentHeight = (maxLat - minLat) * scale;
    const offsetX = (width - contentWidth) / 2;
    const offsetY = (height - contentHeight) / 2;
    const point = ([lng, lat]: number[]) => `${(offsetX + (lng - minLng) * scale).toFixed(1)},${(offsetY + (maxLat - lat) * scale).toFixed(1)}`;
    return {
      width,
      height,
      markers: badges.map(badge => ({ badge, x: offsetX + (badge.longitude - minLng) * scale, y: offsetY + (maxLat - badge.latitude) * scale })),
      paths: features.map((feature) => ({
        feature,
        path: geometryRings(feature.geometry).map((polygon) => polygon.map((ring) => `M${ring.map(point).join("L")}Z`).join(" ")).join(" "),
      })),
    };
  }, [features, mapHeight, mapWidth, badges]);

  const safeViewport = normalizedViewport(viewport, projected.width, projected.height);
  const viewWidth = projected.width / safeViewport.zoom;
  const viewHeight = projected.height / safeViewport.zoom;
  const viewBox = `${safeViewport.centerX - viewWidth / 2} ${safeViewport.centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`;

  function changeZoom(nextZoom: number) {
    setViewport((current) => normalizedViewport({ ...current, zoom: nextZoom }, projected.width, projected.height));
  }

  const badgeForFeature = (feature: MapFeature) => {
    const shapeName = normalizedMapName(feature.properties.shapeName || "");
    return badges.find((badge) => {
      const candidates = [badge.nameEn, badge.slug.replaceAll("_", " "), ...badge.aliases].map(normalizedMapName);
      return candidates.some((candidate) => candidate && (shapeName === candidate || shapeName.includes(candidate) || candidate.includes(shapeName)));
    });
  };

  return (
    <div className={`administrative-map administrative-map-${category}`}>
      <div className="administrative-map-controls" aria-label="เครื่องมือซูมแผนที่">
        <button type="button" onClick={() => changeZoom(safeViewport.zoom + .5)} disabled={safeViewport.zoom >= MAX_MAP_ZOOM} aria-label="ซูมเข้า"><ZoomIn size={16} /></button>
        <button type="button" onClick={() => changeZoom(safeViewport.zoom - .5)} disabled={safeViewport.zoom <= MIN_MAP_ZOOM} aria-label="ซูมออก"><ZoomOut size={16} /></button>
        <button type="button" onClick={() => setViewport({ zoom: MIN_MAP_ZOOM, centerX: mapWidth / 2, centerY: mapHeight / 2 })} disabled={safeViewport.zoom === MIN_MAP_ZOOM} aria-label="แสดงแผนที่ทั้งหมด"><Maximize2 size={15} /></button>
      </div>
      {features.length ? (
        <svg
          data-export-viewbox={`0 0 ${mapWidth} ${mapHeight}`}
          viewBox={viewBox}
          className={safeViewport.zoom > MIN_MAP_ZOOM ? "is-zoomed" : ""}
          role="img"
          aria-label={isWorld ? "แผนที่จุดหมายทั่วโลก" : category === "thailand" ? "แผนที่จังหวัดประเทศไทย" : "แผนที่จังหวัดประเทศญี่ปุ่น"}
          onPointerDown={(event) => {
            if (safeViewport.zoom <= MIN_MAP_ZOOM) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerX: event.clientX, pointerY: event.clientY, centerX: safeViewport.centerX, centerY: safeViewport.centerY };
            dragged.current = false;
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const deltaX = (event.clientX - drag.current.pointerX) * viewWidth / rect.width;
            const deltaY = (event.clientY - drag.current.pointerY) * viewHeight / rect.height;
            if (Math.abs(deltaX) + Math.abs(deltaY) > 2) dragged.current = true;
            setViewport((current) => normalizedViewport({
              ...current,
              centerX: drag.current!.centerX - deltaX,
              centerY: drag.current!.centerY - deltaY,
            }, projected.width, projected.height));
          }}
          onPointerUp={() => { drag.current = null; window.setTimeout(() => { dragged.current = false; }, 0); }}
          onPointerCancel={() => { drag.current = null; dragged.current = false; }}
          onLostPointerCapture={() => {
            drag.current = null;
            window.setTimeout(() => { dragged.current = false; }, 0);
          }}
        >
          {projected.paths.map(({ feature, path }) => {
            const badge = badgeForFeature(feature);
            return (
              <path
                key={`${feature.properties.shapeISO || ""}:${feature.properties.shapeName}`}
                d={path}
                className={`${badge?.unlocked ? "is-visited" : ""} ${badge?.id === selectedId ? "is-selected" : ""}`}
                onClick={(event) => {
                  if (badge && !dragged.current) selectBadge(badge.id);
                  if (event.detail > 0) event.currentTarget.blur();
                }}
                tabIndex={badge ? 0 : undefined}
                role={badge ? "button" : undefined}
                aria-label={badge ? `${badge.nameTh} · ${badge.unlocked ? "ไปมาแล้ว" : "ยังไม่ได้ไป"}` : feature.properties.shapeName}
                onKeyDown={(event) => { if (badge && (event.key === "Enter" || event.key === " ")) selectBadge(badge.id); }}
              />
            );
          })}
          {isWorld ? projected.markers.map(({ badge, x, y }) => <circle key={badge.id}
            cx={x} cy={y} r={(badge.id === selectedId ? 7 : 5) / safeViewport.zoom}
            className={`badge-world-point ${badge.unlocked ? "is-visited" : ""}`}
            role="button" tabIndex={0} aria-label={`${badge.nameTh} · ${badge.visits.length} ทริป`}
            onClick={() => { if (!dragged.current) selectBadge(badge.id); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectBadge(badge.id); } }}
          ><title>{badge.nameTh}</title></circle>) : null}
        </svg>
      ) : <div className="administrative-map-loading">กำลังโหลดแผนที่…</div>}
      <div className="administrative-map-legend"><span className="is-visited" /> ไปมาแล้ว <span /> ยังไม่ได้ไป</div>
      <small>Boundary data: Natural Earth (public domain) · OpenStreetMap contributors · geoBoundaries</small>
    </div>
  );
}

function BadgeArtwork({
  badge,
  size = 104,
  width = size,
}: {
  badge: TravelBadge;
  size?: number;
  width?: number;
}) {
  return (
    <span
      className="travel-badge-artwork"
      style={{ width, height: size }}
      role="img"
      aria-label={`เข็มกลัด ${badge.nameTh}${badge.unlocked ? " ปลดล็อกแล้ว" : " ยังไม่ปลดล็อก"}`}
    >
      <Image className="travel-badge-image" src={badge.image} alt="" fill sizes={`${size}px`} />
      <span className="travel-badge-lock"><LockKeyhole size={Math.max(17, Math.round(size * .22))} /></span>
    </span>
  );
}

function BadgePreviewDialog({ badge, close }: { badge: TravelBadge; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("has-badge-preview");
    document.documentElement.classList.add("has-badge-preview");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("has-badge-preview");
      document.documentElement.classList.remove("has-badge-preview");
    };
  }, [close]);

  return createPortal(
    <dialog ref={dialogRef} className="badge-preview-backdrop" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} aria-labelledby="badge-preview-title">
      <section className="badge-preview-dialog">
        <button type="button" className="badge-preview-close" onClick={close} aria-label="ปิดรูปเข็มกลัด" autoFocus><X size={22} /></button>
        <div className="badge-preview-image">
          {failed ? <p role="alert">โหลดรูปไม่สำเร็จ กรุณาปิดแล้วลองอีกครั้ง</p> : <Image src={badge.image} alt={`เข็มกลัด ${badge.nameTh}`} fill sizes="(max-width: 600px) 84vw, 560px" unoptimized loading="eager" onError={() => setFailed(true)} />}
        </div>
        <div className="badge-preview-copy">
          <h2 id="badge-preview-title">{badge.nameTh}</h2>
          <p>{badge.nameEn}</p>
        </div>
      </section>
    </dialog>, document.body
  );
}

function BadgeGridCard({
  badge,
  selected,
  previewReady,
  selectBadge,
  preparePreview,
  clearPreview,
  previewBadge,
  saveManualVisit,
}: {
  badge: TravelBadge;
  selected: boolean;
  previewReady: boolean;
  selectBadge: (badgeId: string) => void;
  preparePreview: (badgeId: string) => void;
  clearPreview: () => void;
  previewBadge: (badge: TravelBadge) => void;
  saveManualVisit: (badgeId: string, visitedOn: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function unlockToday() {
    setSaving(true);
    setError("");
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    try {
      const save = saveManualVisit(badge.id, today);
      clearPreview();
      await save;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function selectCard() {
    selectBadge(badge.id);
    if (!badge.unlocked) preparePreview(badge.id);
  }

  return (
    <article data-travel-badge-card={badge.id} className={`travel-badge-card ${badge.unlocked ? "is-unlocked" : "is-locked"} ${selected ? "is-selected" : ""} ${previewReady ? "is-preview-ready" : ""}`}>
      {badge.unlocked ? (
        <button
          type="button"
          className="travel-badge-grid-artwork-button"
          onClick={() => {
            selectBadge(badge.id);
            clearPreview();
            previewBadge(badge);
          }}
          aria-label={`เลือกและดูรูปเข็มกลัด ${badge.nameTh} แบบเต็มจอ`}
        >
          <BadgeArtwork badge={badge} size={102} width={96} />
        </button>
      ) : (
        <button
          type="button"
          className="travel-badge-grid-artwork-button"
          onClick={selectCard}
          aria-label={`เลือก ${badge.nameTh} และแสดงปุ่มเคยไปแล้ว`}
        >
          <BadgeArtwork badge={badge} size={102} width={96} />
        </button>
      )}
      <button
        type="button"
        className="travel-badge-card-main"
        onClick={selectCard}
        aria-pressed={selected}
        aria-label={`เลือก ${badge.nameTh}`}
      >
        <strong>{badge.nameTh}</strong>
        <small>{badge.nameEn}</small>
        <span className="travel-badge-status">{badge.unlocked ? <><CheckCircle2 size={12} /> {badge.visits.length} ทริป</> : <><LockKeyhole size={12} /> ยังไม่ปลดล็อก</>}</span>
      </button>
      {previewReady && !badge.unlocked ? <div className="travel-badge-preview-trigger is-unlock-prompt">
        <button type="button" disabled={saving} onClick={unlockToday}><MapPinCheck size={16} /> {saving ? "กำลังบันทึก…" : "เคยไปแล้ว"}</button>
        {error ? <small>{error}</small> : null}
      </div> : null}
    </article>
  );
}

export function TravelBadgesPage({
  collection,
  embedded = false,
}: {
  collection: TravelBadgeCollection;
  embedded?: boolean;
}) {
  const [category, setCategory] = useState<BadgeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [badges, setBadges] = useState(collection.badges);
  const [previewReadyId, setPreviewReadyId] = useState<string | null>(null);
  const [previewBadge, setPreviewBadge] = useState<TravelBadge | null>(null);
  const mapSection = useRef<HTMLElement>(null);
  const [savingMap, setSavingMap] = useState(false);
  const [mapMessage, setMapMessage] = useState("");
  const visibleBadges = useMemo(() => badges
    .filter((badge) => category === "all" || badge.category === category)
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      const visitDifference = b.visits.length - a.visits.length;
      return visitDifference || a.artworkIndex - b.artworkIndex;
    }), [badges, category]);
  const totals = useMemo(() => Object.fromEntries((Object.keys(CATEGORY_META) as TravelBadgeCategory[]).map((key) => {
    const items = badges.filter((badge) => badge.category === key);
    return [key, { unlocked: items.filter((badge) => badge.unlocked).length, total: items.length }];
  })) as TravelBadgeCollection["totals"], [badges]);
  const selected = badges.find((badge) => badge.id === selectedId && (category === "all" || badge.category === category))
    || visibleBadges.find((badge) => badge.unlocked)
    || visibleBadges[0];
  const allUnlocked = Object.values(totals).reduce((sum, item) => sum + item.unlocked, 0);
  const allBadges = badges.length;
  // A map selection must never replace the most frequently visited destination.
  const mostVisited = visibleBadges
    .filter((badge) => badge.visits.length > 0)
    .sort((a, b) => b.visits.length - a.visits.length || a.nameTh.localeCompare(b.nameTh, "th"))[0];

  useEffect(() => {
    if (!previewReadyId) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.("[data-travel-badge-card]");
      if (card?.getAttribute("data-travel-badge-card") !== previewReadyId) setPreviewReadyId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [previewReadyId]);


  async function mutateManualVisit(badgeId: string, visitedOn?: string) {
    const previous = badges.find((badge) => badge.id === badgeId);
    if (visitedOn) {
      setBadges((current) => current.map((badge) => badge.id === badgeId
        ? { ...badge, manualVisitDate: visitedOn, unlocked: true }
        : badge));
    }
    try {
      const response = await fetch(`/api/badges/${encodeURIComponent(badgeId)}`, {
        method: visitedOn ? "POST" : "DELETE",
        headers: visitedOn ? { "Content-Type": "application/json" } : undefined,
        body: visitedOn ? JSON.stringify({ visitedOn }) : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      if (!visitedOn) {
        setBadges((current) => current.map((badge) => badge.id === badgeId
          ? { ...badge, manualVisitDate: null, unlocked: badge.visits.length > 0 }
          : badge));
      }
    } catch (error) {
      if (previous) setBadges((current) => current.map((badge) => badge.id === badgeId ? previous : badge));
      throw error;
    }
  }

  function changeCategory(next: BadgeFilter) {
    setCategory(next);
    setSelectedId(null);
    setPreviewReadyId(null);
  }

  const mapCategory = category;
  const mapBadges = visibleBadges;
  const mapTitle = category === "japan" ? "แผนที่ญี่ปุ่น" : category === "thailand" ? "แผนที่ประเทศไทย" : "แผนที่จุดหมายทั่วโลก";
  const mapSummary = category === "all"
    ? [`ไปมาแล้ว ${allUnlocked} จาก ${allBadges} จุดหมาย`, `ไทย ${totals.thailand.unlocked}/${totals.thailand.total} จังหวัด · ญี่ปุ่น ${totals.japan.unlocked}/${totals.japan.total} จังหวัด`, `นานาชาติ ${totals.international.unlocked}/${totals.international.total} ประเทศ`]
    : [`ไปมาแล้ว ${totals[category].unlocked} จาก ${totals[category].total} ${category === "international" ? "ประเทศ" : "จังหวัด"}`];
  async function saveMap() {
    if (savingMap) return;
    const svg = mapSection.current?.querySelector<SVGSVGElement>(".administrative-map > svg");
    if (!svg) { setMapMessage("แผนที่ยังโหลดไม่เสร็จ กรุณาลองอีกครั้ง"); return; }
    setSavingMap(true);
    setMapMessage("");
    try { await exportTravelMap(svg, mapTitle, mapSummary); setMapMessage("ส่งรูปแผนที่ไปยังรายการดาวน์โหลดแล้ว"); }
    catch (error) { setMapMessage(error instanceof Error ? error.message : "บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSavingMap(false); }
  }
  const filters: Array<{ key: BadgeFilter; label: string; Icon: typeof Trophy }> = [
    { key: "all", label: "ทั้งหมด", Icon: Grid2X2 },
    { key: "thailand", label: "ไทย", Icon: MapIcon },
    { key: "japan", label: "ญี่ปุ่น", Icon: Trophy },
    { key: "international", label: "นานาชาติ", Icon: Globe2 },
  ];
  const ContentRoot = embedded ? "section" : "main";

  return (
    <div className={embedded ? "badges-stats-embedded" : "app-shell flow-shell badges-page-shell badges-detail-page"}>
      <ContentRoot id={embedded ? "travel-badges" : undefined} className={embedded ? "analytics-badge-content" : undefined}>
        {!embedded ? <Link href="/analytics#travel-badges" className="icon-btn badges-back" aria-label="กลับหน้าสถิติ"><ArrowLeft size={22} /></Link> : null}

        <div className="badges-screen badges-screen-redesign">
          <section className="badges-intro">
            <span className="badges-intro-icon"><Trophy size={20} /></span>
            <div>
              {embedded ? <h2>เข็มกลัดการเดินทาง</h2> : <h1>เข็มกลัดการเดินทาง</h1>}
              <p>เก็บทุกการเดินทาง ให้กลายเป็นความทรงจำ</p>
            </div>
            {embedded ? <Link className="badges-see-all" href="/badges">ดูทั้งหมด <ArrowRight size={15} /></Link> : null}
          </section>

          {!embedded ? <section className="badge-progress-grid" aria-label="ความคืบหน้าการสะสม">
            {filters.map(({ key, label, Icon }) => {
              const total = key === "all" ? { unlocked: allUnlocked, total: allBadges } : totals[key];
              return (
                <button type="button" key={key} className={category === key ? "is-active" : ""} onClick={() => changeCategory(key)} aria-pressed={category === key}>
                  <span className={`badge-stat-icon is-${key}`}><Icon size={18} /></span>
                  <span>{label}<small>{total.unlocked} / {total.total}</small></span>
                </button>
              );
            })}
          </section> : null}

          {!embedded ? <section ref={mapSection} className="badge-map-section badge-map-compact badge-map-expanded">
            <div className="badge-map-copy">
              <span><MapPinCheck size={13} /> แผนที่เข็มกลัด</span>
              <h2>{mapTitle}</h2>
              <div className="badge-map-counts">{mapSummary.map(line => <strong key={line}>{line}</strong>)}</div>
              <p>แตะพื้นที่เพื่อดูชื่อ · ซูมแล้วลากเพื่อเลื่อนแผนที่</p>
              {selectedId && selected ? <strong className="badge-map-selection">{selected.nameTh} · {selected.visits.length} ทริป</strong> : null}
            </div>
            <AdministrativeMap key={mapCategory} category={mapCategory} badges={mapBadges} selectedId={selected?.id} selectBadge={setSelectedId} />
            <button type="button" className="badge-map-save" disabled={savingMap} onClick={saveMap}><Download size={18} />{savingMap ? "กำลังสร้างรูป…" : "บันทึกรูปแผนที่"}</button>
            {mapMessage ? <p className="badge-map-feedback" role="status">{mapMessage}</p> : null}
          </section> : null}

          {embedded && mostVisited ? <Link href="/badges" className="badge-destination-highlight">
            <div className="badge-highlight-copy">
              <span>{mostVisited.category === "international" ? "ประเทศที่ไปบ่อยที่สุด" : "จังหวัด / เมืองที่ไปบ่อยที่สุด"}</span>
              <h2>{mostVisited.nameTh}</h2>
              <p>{mostVisited.nameEn} · ไปแล้ว {mostVisited.visits.length} ทริป</p>
            </div>
            <span className="badge-highlight-art">
              <BadgeArtwork badge={mostVisited} size={120} width={120} />
            </span>
          </Link> : null}

          {embedded && !mostVisited ? <p className="badge-summary-empty">ยังไม่มีข้อมูลการเดินทางในหมวดนี้</p> : null}
          {!embedded ? <section className="badge-cabinet-section">
            <div className="badges-section-head badge-collection-heading">
              <div><span><Flame size={14} /> COLLECTION</span><h2>{category === "all" ? "คอลเลกชันของคุณ" : `เข็มกลัด · ${CATEGORY_META[category].label}`}</h2></div>
              <strong>{category === "all" ? allUnlocked : totals[category].unlocked}/{category === "all" ? allBadges : totals[category].total}</strong>
            </div>
            <div className="badge-collection-grid">
              {visibleBadges.map((badge) => (
                <BadgeGridCard
                  key={badge.id}
                  badge={badge}
                  selected={selected?.id === badge.id}
                  previewReady={previewReadyId === badge.id}
                  selectBadge={setSelectedId}
                  preparePreview={setPreviewReadyId}
                  clearPreview={() => setPreviewReadyId(null)}
                  previewBadge={setPreviewBadge}
                  saveManualVisit={mutateManualVisit}
                />
              ))}
            </div>
          </section> : null}
        </div>
      </ContentRoot>
      {previewBadge ? <BadgePreviewDialog key={previewBadge.id} badge={previewBadge} close={() => setPreviewBadge(null)} /> : null}
    </div>
  );
}
