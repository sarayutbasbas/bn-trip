"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Compass, List, MapPin, Maximize2, Minimize2, Search, Sparkles, X, ZoomIn } from "lucide-react";
import { AttachmentPreviewOverlay } from "./attachment-preview-overlay";
import type { BookEngine } from "./plan-book-flipper";
import type { PlanBookTrip } from "@/src/lib/plan-book";
import styles from "./plan-book.module.css";

const PlanBookFlipper = dynamic(() => import("./plan-book-flipper").then(module => module.PlanBookFlipper), { ssr: false });

const dateLabel = (date: string) => date ? new Intl.DateTimeFormat("th-TH", {
  day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok",
}).format(new Date(`${date}T12:00:00+07:00`)) : "";

function FantasyCover({ count }: { count: number }) {
  const id = useId();
  return <div className={styles.cover}>
    <div className={styles.coverBorder} />
    <div className={styles.coverBrand}><Sparkles size={13} /> ROUTERAO COLLECTION</div>
    <div className={styles.coverTitle}><span>บันทึกการผจญภัย</span><h2>ทุกแพลน<br />ทุกความฝัน</h2><p>เปิดโลกของเรา ทีละหน้า</p></div>
    <svg className={styles.landscape} viewBox="0 0 400 430" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="200" y1="0" x2="200" y2="430" gradientUnits="userSpaceOnUse"><stop stopColor="#ffd6a1"/><stop offset="1" stopColor="#edac67"/></linearGradient>
        <linearGradient id={`${id}-road`} x1="200" y1="190" x2="200" y2="430" gradientUnits="userSpaceOnUse"><stop stopColor="#fff9e7"/><stop offset="1" stopColor="#fff2db"/></linearGradient>
        <g id={`${id}-blossom`}>
          {[0,72,144,216,288].map(angle => <ellipse key={angle} cy="-9" rx="7" ry="11" transform={`rotate(${angle})`} fill="#f4ad51" stroke="#fff5e5" strokeWidth="1.5"/>)}
          <circle r="4" fill="#e9b66f"/>
        </g>
      </defs>
      <ellipse cx="200" cy="170" rx="128" ry="144" stroke="#da9a47" strokeOpacity=".5"/>
      <ellipse cx="200" cy="170" rx="115" ry="131" stroke="#da9a47" strokeOpacity=".25"/>
      <circle cx="215" cy="119" r="43" fill="#ffe3a9"/>
      <path d="M0 240 55 186 99 229 173 131 247 239 308 166 400 243V430H0Z" fill="#a4b5ad"/>
      <path d="m173 131-30 40 30-13 19 21Z" fill="#fffaf7"/>
      <path d="M0 285 80 231 150 280 259 210 400 289V430H0Z" fill="#c6c5a3"/>
      <path d="M0 322Q80 264 200 287T400 294V430H0Z" fill={`url(#${id}-sky)`}/>
      <path d="M207 264c-90 53 108 45 7 101-28 15-28 39 33 65h-90c-42-45-13-62 31-80 102-40-68-29 19-86Z" fill={`url(#${id}-road)`}/>
      <g fill="#b56a28"><path d="M256 237v-39h8v-15l5-10 5 10v15h8v39zm-6 0h37v4h-37z"/><path d="m77 119 3 9 9 3-9 3-3 9-3-9-9-3 9-3zm232-37 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/><circle cx="120" cy="78" r="2"/><circle cx="286" cy="133" r="2"/><circle cx="234" cy="51" r="2"/></g>
      <path d="M8 273Q56 208 26 117M372 286Q327 230 378 119" stroke="#a7895d" strokeWidth="4" strokeLinecap="round"/>
      {[[28,139,1.2],[46,180,.85],[25,219,1.1],[362,145,1.3],[344,196,.85],[377,240,1],[80,318,.6],[312,345,.65]].map(([x,y,scale],index) => <use key={index} href={`#${id}-blossom`} transform={`translate(${x} ${y}) scale(${scale})`}/>)}
      <path d="M20 404h360" stroke="#b98747" strokeOpacity=".35"/>
    </svg>
    <div className={styles.coverFoot}><Compass size={17}/><span>{count} การเดินทาง · เรื่องราวที่รอเปิดอ่าน</span></div>
  </div>;
}

function PlanImage({ trip }: { trip: PlanBookTrip }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return <div className={styles.imageError}><BookOpen/><p>โหลดรูปแพลนไม่สำเร็จ</p><button type="button" onClick={() => { setFailed(false); setLoaded(false); }}>ลองใหม่</button><Link href={`/trips/${trip.id}`}>ไปที่ทริป</Link></div>;
  return <div className={styles.planImage} role="button" tabIndex={0} aria-label={`ดูแพลน ${trip.name} ขนาดเต็ม`}>
    {!loaded && <span className={styles.imageLoading}>กำลังเปิดแพลน…</span>}
    <Image src={trip.summary_image_url} alt={`แพลนเที่ยว ${trip.name}`} fill unoptimized sizes="(orientation: portrait) 100vw, 56.25vh" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    <span className={styles.zoomHint}><Maximize2 size={13}/> แตะเพื่ออ่านเต็มจอ</span>
  </div>;
}

export function PlanBook({ trips }: { trips: PlanBookTrip[] }) {
  const [page, setPage] = useState(0);
  const engine = useRef<BookEngine | null>(null);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  const changePage = (target: number) => {
    if (target >= 0 && target <= trips.length) engine.current?.pageFlip()?.turnToPage(target);
  };
  const pages = useMemo(() => [
    <div key="cover" className={styles.flipPage} data-density="soft"><FantasyCover count={trips.length}/></div>,
    ...trips.map(trip => <div key={trip.id} className={styles.flipPage} data-density="soft"><PlanImage trip={trip}/></div>),
  ], [trips]);
  const [immersive, setImmersive] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [preview, setPreview] = useState<PlanBookTrip | null>(null);
  const [search, setSearch] = useState("");
  const [contentsOpen, setContentsOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const contentsButton = useRef<HTMLButtonElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const ownsFullscreen = useRef(false);
  const wantsFullscreen = useRef(false);
  const current = page ? trips[page - 1] : null;

  const enterFullscreen = () => {
    setImmersive(true);
    setChrome(true);
    wantsFullscreen.current = true;
    // iPhone/PWA fallback is the same edge-to-edge reader without a browser API.
    // Use the document root so the existing zoom viewer's portal remains visible.
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().then(() => {
        ownsFullscreen.current = true;
        if (!wantsFullscreen.current) void document.exitFullscreen().catch(() => {});
      }).catch(() => { /* CSS fullscreen stays available when native fullscreen is unsupported. */ });
    }
  };
  const leaveFullscreen = useCallback(() => {
    wantsFullscreen.current = false;
    setImmersive(false);
    setChrome(true);
    if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    ownsFullscreen.current = false;
  }, []);
  useEffect(() => {
    const changed = () => {
      if (!document.fullscreenElement && ownsFullscreen.current) leaveFullscreen();
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      wantsFullscreen.current = false;
      document.removeEventListener("fullscreenchange", changed);
      if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [leaveFullscreen]);

  useEffect(() => {
    if (!immersive || !chrome || contentsOpen || preview) return;
    const timer = window.setTimeout(() => setChrome(false), 3500);
    return () => window.clearTimeout(timer);
  }, [immersive, chrome, contentsOpen, preview, page]);

  useEffect(() => {
    if (!book.current) return;
    const observer = new ResizeObserver(() => engine.current?.pageFlip()?.getUI().update());
    observer.observe(book.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!immersive || contentsOpen || preview) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") leaveFullscreen(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [immersive, contentsOpen, preview, leaveFullscreen]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
    requestAnimationFrame(() => book.current?.focus({ preventScroll: true }));
  }, []);
  const closeContents = () => { dialog.current?.close(); setContentsOpen(false); contentsButton.current?.focus(); };
  const matching = useMemo(() => trips.map((trip, index) => ({ trip, page: index + 1 })).filter(({ trip }) => `${trip.name} ${trip.destination}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [trips, search]);

  const controlsHidden = immersive && !chrome && !contentsOpen && !preview;

  return <main data-book-fullscreen={immersive} className={`${styles.shell} ${immersive ? styles.immersive : ""} ${controlsHidden ? styles.hideControls : ""}`} onKeyDown={event => {
    if (preview || contentsOpen || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName)) return;
    if (event.key === "ArrowRight") { event.preventDefault(); engine.current?.flipNext(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); engine.current?.flipPrev(); }
    if (event.key === "Escape") leaveFullscreen();
  }}>
    <header className={styles.header} inert={controlsHidden}>
      {immersive ? <button type="button" className={styles.iconButton} aria-label="ปิดหนังสือเต็มจอ" onClick={leaveFullscreen}><X size={20}/></button> : <Link href="/" className={styles.iconButton} aria-label="กลับหน้าหลัก"><ArrowLeft size={20}/></Link>}
      <div><h1>{immersive ? current?.name || "สมุดแพลน" : "สมุดแพลน"}</h1><span>ทุกการเดินทางในเล่มเดียว</span></div>
      <button type="button" className={styles.iconButton} disabled={!trips.length} onClick={immersive ? leaveFullscreen : enterFullscreen} aria-label={immersive ? "ออกจากเต็มจอ" : "อ่านเต็มจอ"}>{immersive ? <Minimize2 size={19}/> : <Maximize2 size={19}/>}</button>
    </header>

    {!trips.length ? <section className={styles.empty}><BookOpen size={42}/><h2>การผจญภัยหน้าแรก รอคุณอยู่</h2><p>เพิ่มรูปแพลนรวมในหน้าแก้ไขทริป<br/>แล้วกลับมาเปิดอ่านทุกแพลนในเล่มนี้ได้เลย</p><Link href="/trips">เลือกทริปเพื่อเพิ่มแพลน <ArrowRight size={17}/></Link></section> : <>
      <div className={styles.intro}><span><Sparkles size={14}/> {trips.length} แพลนพร้อมออกเดินทาง</span><small>วันเดินทางใหม่ → เก่า</small></div>
      <section className={styles.stage} aria-label="หนังสือรวมแพลนเที่ยว">
        <div ref={book} className={styles.book} data-book-base data-book-page={page} tabIndex={0}
          onPointerDownCapture={event => { gesture.current = { x: event.clientX, y: event.clientY, moved: false }; }}
          onPointerMoveCapture={event => {
            if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true;
          }}
          onPointerCancel={() => { gesture.current.moved = true; }}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (immersive) setChrome(value => !value); else enterFullscreen(); }
          }} onClick={event => {
          if (gesture.current.moved || (event.target as HTMLElement).closest("button,a")) return;
          if (immersive) setChrome(value => !value); else if (page > 0) enterFullscreen();
        }}>
          <PlanBookFlipper engine={engine} startPage={0} onPageChange={setPage}>{pages}</PlanBookFlipper>
        </div>
      </section>
      <div className={styles.caption} aria-live="polite" aria-atomic="true">
        {current ? <strong>{current.name}</strong> : <button type="button" data-book-control className={styles.openBook} onClick={() => { enterFullscreen(); changePage(1); }}><BookOpen size={17}/>เปิดสมุดแพลน <ArrowRight size={17}/></button>}
        {current && <span><MapPin size={12}/>{current.destination} · {dateLabel(current.travel_date)}</span>}
      </div>
      <footer className={styles.controls} inert={controlsHidden}>
        <div className={styles.navigation}>
          <button type="button" className={styles.iconButton} disabled={page === 0} onClick={() => engine.current?.flipPrev()} aria-label="หน้าก่อนหน้า"><ChevronLeft/></button>
          <div><strong>{page === 0 ? "หน้าปก" : `แพลน ${page} / ${trips.length}`}</strong><span>{page === trips.length ? "หน้าสุดท้ายของเล่ม" : "ปัดซ้าย–ขวาเพื่อพลิกหน้า"}</span></div>
          <button type="button" className={styles.iconButton} disabled={page === trips.length} onClick={() => engine.current?.flipNext()} aria-label="หน้าถัดไป"><ChevronRight/></button>
        </div>
        <div className={styles.progress}><span style={{ width: `${page / trips.length * 100}%` }}/></div>
        <div className={styles.tools}>
          <button ref={contentsButton} type="button" aria-haspopup="dialog" onClick={() => { setSearch(""); setChrome(true); setContentsOpen(true); dialog.current?.showModal(); }}><List size={18}/> เลือกทริป</button>
          <button type="button" onClick={() => changePage(0)} disabled={page === 0}><BookOpen size={17}/> หน้าปก</button>
          {current && <button type="button" aria-label="ขยายรูปแพลน" onClick={() => { setChrome(true); setPreview(current); }}><ZoomIn size={17}/><span>ขยาย</span></button>}
          {current && <Link href={`/trips/${current.id}`}>ไปที่ทริป <ArrowRight size={15}/></Link>}
        </div>
      </footer>
    </>}

    <dialog ref={dialog} className={styles.contents} aria-labelledby="plan-book-contents-title" onClose={() => setContentsOpen(false)} onClick={event => { if (event.target === event.currentTarget) closeContents(); }}>
      {contentsOpen && <div className={styles.contentsInner}>
        <header><div><span>YOUR TRAVEL CHAPTERS</span><h2 id="plan-book-contents-title">เลือกการเดินทาง</h2></div><button type="button" className={styles.iconButton} onClick={closeContents} aria-label="ปิดสารบัญ"><X size={20}/></button></header>
        <label className={styles.search}><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาทริปหรือจุดหมาย" aria-label="ค้นหาแพลน"/></label>
        <p className={styles.contentsCount}>{trips.length} แพลน · เรียงตามวันเดินทางใหม่ไปเก่า</p>
        <div className={styles.chapters}>{matching.map(({ trip, page: target }) => <button type="button" key={trip.id} className={page === target ? styles.selected : ""} aria-current={page === target ? "page" : undefined} onClick={() => { changePage(target); closeContents(); }}>
          <div className={styles.thumbnail}><Image src={trip.summary_image_url} alt="" fill unoptimized sizes="46px" loading="lazy"/></div>
          <span><strong>{trip.name}</strong><small>{trip.destination}</small><small>{dateLabel(trip.travel_date)}</small></span><em>{String(target).padStart(2, "0")}</em>
        </button>)}{!matching.length && <p>ไม่พบแพลนที่ค้นหา ลองใช้ชื่อทริปหรือจุดหมายอื่น</p>}</div>
      </div>}
    </dialog>
    {preview && <AttachmentPreviewOverlay preview={{ url: preview.summary_image_url, title: preview.name, mimeType: "image/jpeg" }} onClose={closePreview} closeLabel="ปิดรูป"/>}
  </main>;
}
