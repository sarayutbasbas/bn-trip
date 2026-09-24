"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Flame,
  Globe2,
  Grid2X2,
  LockKeyhole,
  Map as MapIcon,
  MapPinCheck,
  Maximize2,
  Plane,
  RefreshCw,
  Trash2,
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
import { getCurrentAccount } from "@/src/lib/client-account";
import { InvitationNotifications } from "@/src/components/invitation-notifications";

type HeaderProfile = { id: string; email: string; display_name: string; avatar_url: string | null };
type BadgeFilter = "all" | TravelBadgeCategory;

const CATEGORY_META: Record<TravelBadgeCategory, { label: string; eyebrow: string }> = {
  thailand: { label: "ไทย", eyebrow: "77 PROVINCES" },
  japan: { label: "ญี่ปุ่น", eyebrow: "47 PREFECTURES" },
  international: { label: "นานาชาติ", eyebrow: "SUPPORTED COUNTRIES" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

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
  category: Exclude<TravelBadgeCategory, "international">;
  badges: TravelBadge[];
  selectedId?: string;
  selectBadge: (id: string) => void;
}) {
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const mapWidth = 900;
  const mapHeight = category === "thailand" ? 720 : 620;
  const [viewport, setViewport] = useState<MapViewport>({ zoom: MIN_MAP_ZOOM, centerX: mapWidth / 2, centerY: mapHeight / 2 });
  const drag = useRef<{ pointerX: number; pointerY: number; centerX: number; centerY: number } | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    let active = true;
    fetch(`/maps/${category === "thailand" ? "thailand" : "japan"}-adm1.geojson`)
      .then((response) => response.json() as Promise<MapCollection>)
      .then((collection) => { if (active) setFeatures(collection.features); })
      .catch(() => { if (active) setFeatures([]); });
    return () => { active = false; };
  }, [category]);

  const projected = useMemo(() => {
    const width = mapWidth;
    const height = mapHeight;
    const coordinates = features.flatMap((feature) => geometryRings(feature.geometry).flat(2));
    if (!coordinates.length) return { width, height, paths: [] as Array<{ feature: MapFeature; path: string }> };
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
      paths: features.map((feature) => ({
        feature,
        path: geometryRings(feature.geometry).map((polygon) => polygon.map((ring) => `M${ring.map(point).join("L")}Z`).join(" ")).join(" "),
      })),
    };
  }, [features, mapHeight, mapWidth]);

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
          viewBox={viewBox}
          className={safeViewport.zoom > MIN_MAP_ZOOM ? "is-zoomed" : ""}
          role="img"
          aria-label={category === "thailand" ? "แผนที่จังหวัดประเทศไทย" : "แผนที่จังหวัดประเทศญี่ปุ่น"}
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
                key={feature.properties.shapeISO || feature.properties.shapeName}
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
        </svg>
      ) : <div className="administrative-map-loading">กำลังโหลดแผนที่…</div>}
      <div className="administrative-map-legend"><span className="is-visited" /> ไปมาแล้ว <span /> ยังไม่ได้ไป</div>
      <small>Boundary data © OpenStreetMap contributors · geoBoundaries</small>
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

function BadgeDetails({
  badge,
  saveManualVisit,
  removeManualVisit,
  previewBadge,
}: {
  badge: TravelBadge;
  saveManualVisit: (badgeId: string, visitedOn: string) => Promise<void>;
  removeManualVisit: (badgeId: string) => Promise<void>;
  previewBadge: (badge: TravelBadge) => void;
}) {
  const [visitedOn, setVisitedOn] = useState(badge.manualVisitDate || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setConfirmingDelete(false); };
    document.addEventListener("keydown", handleKeyDown);
    document.documentElement.classList.add("confirm-open");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.documentElement.classList.remove("confirm-open");
    };
  }, [confirmingDelete, saving]);

  async function markVisited() {
    setSaving(true);
    setError("");
    try { await saveManualVisit(badge.id, visitedOn); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function removeVisit() {
    setSaving(true);
    setError("");
    try {
      await removeManualVisit(badge.id);
      setConfirmingDelete(false);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  return <>
    <article className={`badge-detail-card ${badge.unlocked ? "is-unlocked" : "is-locked"}`}>
      {badge.unlocked ? (
        <button type="button" className="badge-detail-artwork-button" onClick={() => previewBadge(badge)} aria-label={`ดูเข็มกลัด ${badge.nameTh} แบบเต็มจอ`}>
          <BadgeArtwork badge={badge} size={86} />
        </button>
      ) : (
        <span className="badge-detail-artwork-button" aria-hidden="true">
          <BadgeArtwork badge={badge} size={86} />
        </span>
      )}
      <div className="badge-detail-copy">
        <span className="badge-detail-state">
          {badge.unlocked ? <><CheckCircle2 size={14} /> ปลดล็อกแล้ว</> : <><LockKeyhole size={14} /> ยังไม่ได้ไปเยือน</>}
        </span>
        <h3>{badge.nameTh}</h3>
        <p>{badge.nameEn}</p>
        {badge.unlocked ? (
          <div className="badge-visit-list">
            {badge.manualVisitDate && <div className="badge-manual-visit-row">
              <span><CalendarDays size={13} /> {formatDate(badge.manualVisitDate)}</span>
              <button type="button" className="badge-remove-manual" disabled={saving} onClick={() => setConfirmingDelete(true)} aria-label="ลบการยืนยันว่าเคยไป"><Trash2 size={14} /></button>
            </div>}
            {badge.visits.map((visit) => (
              <div key={visit.id}>
                <CalendarDays size={13} /> {formatDate(visit.startDate)}
                {visit.endDate !== visit.startDate ? ` – ${formatDate(visit.endDate)}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <div className="badge-manual-unlock">
            <div>
              <input type="date" value={visitedOn} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setVisitedOn(event.target.value)} aria-label="วันที่เคยเดินทางไป" />
              <button type="button" disabled={saving || !visitedOn} onClick={markVisited} aria-label={saving ? "กำลังบันทึก" : "ยืนยันว่าเคยไปมาแล้ว"} title="เคยไปมาแล้ว"><MapPinCheck size={16} /></button>
            </div>
          </div>
        )}
        {error && <small className="badge-manual-error">{error}</small>}
      </div>
    </article>
    {confirmingDelete ? <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmingDelete(false); }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="badge-delete-confirm-title">
        <span className="confirm-icon"><AlertTriangle size={22} /></span>
        <h2 id="badge-delete-confirm-title">ลบการยืนยันว่าเคยไป?</h2>
        <p>เข็มกลัด {badge.nameTh} จะกลับไปเป็นสถานะยังไม่ปลดล็อก หากไม่มีทริปที่เกี่ยวข้อง</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" disabled={saving} onClick={() => setConfirmingDelete(false)}>ยกเลิก</button>
          <button type="button" className="confirm-delete" disabled={saving} onClick={removeVisit}>{saving ? "กำลังลบ…" : "ยืนยันการลบ"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}

function BadgePreviewDialog({ badge, close }: { badge: TravelBadge; close: () => void }) {
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

  return (
    <div className="badge-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={`badge-preview-dialog ${badge.unlocked ? "is-unlocked" : "is-locked"}`} role="dialog" aria-modal="true" aria-labelledby="badge-preview-title">
        <button type="button" className="badge-preview-close" onClick={close} aria-label="ปิดรูปเข็มกลัด" autoFocus><X size={22} /></button>
        <div className="badge-preview-image"><BadgeArtwork badge={badge} size={560} /></div>
        <div className="badge-preview-copy">
          <h2 id="badge-preview-title">{badge.nameTh}</h2>
          <p>{badge.nameEn}</p>
        </div>
      </section>
    </div>
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
  const router = useRouter();
  const [category, setCategory] = useState<BadgeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [badges, setBadges] = useState(collection.badges);
  const [previewReadyId, setPreviewReadyId] = useState<string | null>(null);
  const [previewBadge, setPreviewBadge] = useState<TravelBadge | null>(null);
  const [showSelectedDetails, setShowSelectedDetails] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
  const avatarLabel = (profile?.display_name || profile?.email || "?").trim();

  useEffect(() => {
    let active = true;
    getCurrentAccount().then((account) => {
      if (!active) return;
      setProfile(account);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function refreshPage() {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  }

  useEffect(() => {
    if (!previewReadyId) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.("[data-travel-badge-card]");
      if (card?.getAttribute("data-travel-badge-card") !== previewReadyId) setPreviewReadyId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [previewReadyId]);

  useEffect(() => {
    const updateScrollButton = () => setShowScrollTop(window.scrollY > 520);
    updateScrollButton();
    window.addEventListener("scroll", updateScrollButton, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollButton);
  }, []);

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
    setShowSelectedDetails(false);
  }

  const mapCategory: Exclude<TravelBadgeCategory, "international"> =
    category === "thailand" || category === "japan"
      ? category
      : selected?.category === "japan"
        ? "japan"
        : "thailand";
  const mapBadges = badges.filter((badge) => badge.category === mapCategory);
  const filters: Array<{ key: BadgeFilter; label: string; Icon: typeof Trophy }> = [
    { key: "all", label: "ทั้งหมด", Icon: Grid2X2 },
    { key: "thailand", label: "ไทย", Icon: MapIcon },
    { key: "japan", label: "ญี่ปุ่น", Icon: Trophy },
    { key: "international", label: "นานาชาติ", Icon: Globe2 },
  ];
  const ContentRoot = embedded ? "section" : "main";

  return (
    <div className={embedded ? "badges-stats-embedded" : "app-shell flow-shell main-nav-page-shell badges-page-shell"}>
      <ContentRoot id={embedded ? "travel-badges" : undefined} className={embedded ? "analytics-badge-content" : undefined}>
        {!embedded ? <header className="mobile-head flow-header">
          <Link className="brand" href="/" aria-label="RouteRao · หน้าแรก">
            <Image src="/routerao-logo-transparent-512.png" alt="RouteRao" width={48} height={48} priority unoptimized />
            <div>RouteRao<small>travel smarter together</small></div>
          </Link>
          <nav className="mobile-actions" aria-label="เมนูหลัก">
            <button className="icon-btn home-refresh-btn" type="button" onClick={refreshPage} disabled={refreshing} aria-label="รีเฟรช" title="รีเฟรช"><RefreshCw className={refreshing ? "analytics-refresh-spinning" : ""} size={24} /></button>
            <InvitationNotifications onChanged={()=>router.refresh()}/>
            <button className="home-profile-btn" type="button" onClick={() => router.push("/settings")} aria-label="โปรไฟล์" title="โปรไฟล์"><span className="account-avatar account-avatar-small"><span className="account-avatar-image" style={profile?.avatar_url ? { backgroundImage: `url("${profile.avatar_url}")` } : undefined}>{!profile?.avatar_url && avatarLabel.charAt(0).toUpperCase()}</span></span></button>
          </nav>
        </header> : null}

        <div className="badges-screen badges-screen-redesign">
          <section className="badges-intro">
            <span className="badges-intro-icon"><Trophy size={20} /></span>
            <div>
              {embedded ? <h2>เข็มกลัดการเดินทาง</h2> : <h1>เข็มกลัดการเดินทาง</h1>}
              <p>เก็บทุกการเดินทาง ให้กลายเป็นความทรงจำ</p>
            </div>
          </section>

          <section className="badge-progress-grid" aria-label="ความคืบหน้าการสะสม">
            {(Object.keys(CATEGORY_META) as TravelBadgeCategory[]).map((key, index) => {
              const total = totals[key];
              const Icon = index === 0 ? MapPinCheck : index === 1 ? Trophy : Plane;
              return (
                <button type="button" key={key} className={category === key ? "is-active" : ""} onClick={() => changeCategory(key)} aria-pressed={category === key}>
                  <span className={`badge-stat-icon is-${key}`}><Icon size={18} /></span>
                  <span>{CATEGORY_META[key].label}<small>{total.unlocked} / {total.total}</small></span>
                </button>
              );
            })}
          </section>

          <section className="badge-map-section badge-map-compact">
            <div className="badge-map-copy">
              <span><MapPinCheck size={13} /> แผนที่เข็มกลัด</span>
              <h2>เลือกประเทศ<br />ดูเข็มกลัดได้เลย</h2>
              <p>แตะพื้นที่เพื่อดูรายละเอียด</p>
            </div>
            <AdministrativeMap key={mapCategory} category={mapCategory} badges={mapBadges} selectedId={selected?.id} selectBadge={setSelectedId} />
          </section>

          {selected ? <section className="badge-destination-highlight">
            <div className="badge-highlight-copy">
              <span>Destination Highlight</span>
              <h2>{selected.nameTh}</h2>
              <p>{selected.nameEn} · {selected.unlocked ? `ปลดล็อกจาก ${selected.visits.length || 1} ทริป` : "ยังไม่ปลดล็อก"}</p>
              <button type="button" onClick={() => selected.unlocked ? setPreviewBadge(selected) : setPreviewReadyId(selected.id)}>
                ดูเข็มกลัดทั้งหมด <ArrowRight size={15} />
              </button>
            </div>
            <button type="button" className="badge-highlight-art" onClick={() => selected.unlocked ? setPreviewBadge(selected) : setPreviewReadyId(selected.id)} aria-label={`ดูเข็มกลัด ${selected.nameTh}`}>
              <BadgeArtwork badge={selected} size={150} width={150} />
            </button>
          </section> : null}

          {selected ? <details className="badge-feature-details" onToggle={(event) => setShowSelectedDetails(event.currentTarget.open)}>
            <summary>ข้อมูลการปลดล็อก <ArrowRight size={15} /></summary>
            {showSelectedDetails ? <div data-badge-featured><BadgeDetails key={`${selected.id}:${selected.manualVisitDate || "trip"}`} badge={selected} saveManualVisit={mutateManualVisit} removeManualVisit={(badgeId) => mutateManualVisit(badgeId)} previewBadge={setPreviewBadge} /></div> : null}
          </details> : null}

          <nav className="badge-filter-tabs" aria-label="กรองประเภทเข็มกลัด">
            {filters.map(({ key, label, Icon }) => (
              <button type="button" key={key} className={category === key ? "is-active" : ""} onClick={() => changeCategory(key)} aria-pressed={category === key}>
                <Icon size={15} /><span>{label}</span><small>({key === "all" ? allBadges : totals[key].total})</small>
              </button>
            ))}
          </nav>

          <section className="badge-cabinet-section">
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
          </section>
        </div>
      </ContentRoot>
      {showScrollTop ? <button type="button" className="expense-back-top badges-scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="กลับด้านบน" aria-label="กลับด้านบน"><ArrowUp size={18} /></button> : null}
      {previewBadge ? <BadgePreviewDialog badge={previewBadge} close={() => setPreviewBadge(null)} /> : null}
    </div>
  );
}
