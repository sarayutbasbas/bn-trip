"use client";

import { ReactFlipBook } from "@vuvandinh203/react-flipbook";
import { memo, useCallback, useEffect, useRef, type ComponentRef, type ReactNode, type RefObject } from "react";

export type BookEngine = ComponentRef<typeof ReactFlipBook>;

// Keep the wrapper's children/settings stable while its engine moves page DOM nodes.
export const PlanBookFlipper = memo(function PlanBookFlipper({ children, engine, startPage, onPageChange }: {
  children: ReactNode;
  engine: RefObject<BookEngine | null>;
  startPage: number;
  onPageChange: (page: number) => void;
}) {
  const initialPage = useRef(startPage);
  const host = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const ownedEngine = useRef<ReturnType<BookEngine["pageFlip"]>>(undefined);
  const bindEngine = useCallback((handle: BookEngine | null) => {
    engine.current = handle;
    const core = handle?.pageFlip();
    if (core && core !== ownedEngine.current) {
      ownedEngine.current = core;
      core.on("changeState", (event: { data: unknown }) => {
        if (host.current) host.current.dataset.bookState = String(event.data);
      });
    }
  }, [engine]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let origin: { x: number; y: number } | null = null;
    let dragging = false;
    let startedAt = 0;
    let direction = 1;
    let anchor = { x: 0, y: 0 };
    let lastFold = { x: 0, y: 0 };
    let settleFrame = 0;
    let settling = false;
    let mouseStartedHere = false;
    let scale = 1, offsetX = 0, offsetY = 0;
    let pinch: { distance: number; scale: number; x: number; y: number; offsetX: number; offsetY: number } | null = null;
    let pan: { x: number; y: number } | null = null;
    let zoomGesture = false;
    let suppressClickUntil = 0;
    const drawZoom = () => {
      const maxX = element.clientWidth * (scale - 1) / 2;
      const maxY = element.clientHeight * (scale - 1) / 2;
      offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
      offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
      if (paper.current) paper.current.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      element.dataset.bookZoom = scale.toFixed(2);
    };
    const resetZoom = () => { scale = 1; offsetX = offsetY = 0; pinch = null; pan = null; zoomGesture = false; drawZoom(); };
    const base = element.closest('[data-book-base]');
    const shell = element.closest('[data-book-fullscreen]');
    const observer = new MutationObserver(resetZoom);
    if (base) observer.observe(base, { attributes: true, attributeFilter: ['data-book-page'] });
    if (shell) observer.observe(shell, { attributes: true, attributeFilter: ['data-book-fullscreen'] });
    const zoomAllowed = () => shell?.getAttribute('data-book-fullscreen') === 'true';
    const center = (event: TouchEvent) => {
      const a = event.touches[0], b = event.touches[1];
      const rect = element.getBoundingClientRect();
      return { x: (a.clientX + b.clientX) / 2 - rect.left - rect.width / 2, y: (a.clientY + b.clientY) / 2 - rect.top - rect.height / 2,
        distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) };
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const doubleClick = (event: MouseEvent) => {
      if (!zoomAllowed()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (scale > 1) resetZoom();
      else { scale = 2; drawZoom(); }
    };
    const mouseDown = (event: MouseEvent) => {
      if (scale > 1) { event.stopImmediatePropagation(); return; }
      mouseStartedHere = true;
    };
    const mouseUp = (event: MouseEvent) => {
      const core = engine.current?.pageFlip();
      if (mouseStartedHere && core && core.getState() === "read") {
        const rect = core.getUI().getDistElement().getBoundingClientRect();
        // A tap opens the reader; only a drag should turn paper. Keep the
        // engine's click setting enabled because it also gates flipPrev().
        core.userStop({ x: event.clientX - rect.left, y: event.clientY - rect.top }, true);
      }
      mouseStartedHere = false;
    };
    const point = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const rect = engine.current?.pageFlip()?.getUI().getDistElement().getBoundingClientRect();
      return touch && rect ? { x: touch.clientX - rect.left, y: touch.clientY - rect.top } : null;
    };
    // The package's native touch handler waits 250ms before tracking. Feed its
    // public engine directly after horizontal intent so the paper follows now.
    // Vertical gestures do not turn pages in the fixed-height reader.
    const start = (event: TouchEvent) => {
      event.stopImmediatePropagation();
      if (settling) return;
      if (zoomAllowed() && (event.touches.length >= 2 || scale > 1)) {
        if (event.cancelable) event.preventDefault();
        if (dragging) {
          const core = engine.current?.pageFlip();
          core?.userStop(lastFold, true);
          core?.getFlipController().fold(anchor);
          core?.getFlipController().stopMove();
        }
        origin = null; dragging = false; zoomGesture = true;
        suppressClickUntil = performance.now() + 700;
        if (event.touches.length >= 2) pinch = { ...center(event), scale, offsetX, offsetY };
        else pan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        return;
      }
      if (dragging && origin) engine.current?.pageFlip()?.userStop(origin);
      origin = event.touches.length === 1 ? point(event) : null;
      dragging = false;
      startedAt = performance.now();
    };
    const move = (event: TouchEvent) => {
      event.stopImmediatePropagation();
      if (zoomGesture) {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil = performance.now() + 700;
        if (pinch && event.touches.length >= 2) {
          const next = center(event);
          scale = Math.max(1, Math.min(4, pinch.scale * next.distance / pinch.distance));
          const ratio = scale / pinch.scale;
          offsetX = next.x - (pinch.x - pinch.offsetX) * ratio;
          offsetY = next.y - (pinch.y - pinch.offsetY) * ratio;
          drawZoom();
        } else if (pan && event.touches.length === 1) {
          const next = event.touches[0];
          offsetX += next.clientX - pan.x; offsetY += next.clientY - pan.y;
          pan = { x: next.clientX, y: next.clientY }; drawZoom();
        }
        return;
      }
      const current = point(event), core = engine.current?.pageFlip();
      if (!origin || !current || !core) return;
      const dx = Math.abs(current.x - origin.x), dy = Math.abs(current.y - origin.y);
      if (!dragging && dy > 8 && dy > dx) { origin = null; return; }
      if (!dragging && dx > 5 && dx > dy) {
        direction = current.x < origin.x ? 1 : -1;
        const bounds = core.getRender().getRect();
        // Select the page by swipe direction, not by which half was touched.
        anchor = { x: bounds.left + bounds.pageWidth + (direction === 1 ? bounds.pageWidth - 1 : -1), y: origin.y };
        if (!core.getFlipController().start(anchor)) { origin = null; return; }
        core.startUserTouch(anchor);
        dragging = true;
      }
      if (dragging) {
        if (event.cancelable) event.preventDefault();
        lastFold = { x: anchor.x + current.x - origin.x, y: current.y };
        core.userMove(lastFold, true);
      }
    };
    const end = (event: TouchEvent) => {
      event.stopImmediatePropagation();
      if (zoomGesture) {
        suppressClickUntil = performance.now() + 700;
        pinch = null;
        pan = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
        if (!event.touches.length || event.type === 'touchcancel') {
          zoomGesture = false; pan = null;
          if (scale < 1.05) resetZoom();
        }
        return;
      }
      const current = point(event);
      const core = engine.current?.pageFlip();
      if (dragging && current && core && origin) {
        const bounds = core.getRender().getRect();
        const distance = (origin.x - current.x) * direction;
        const threshold = Math.min(48, bounds.pageWidth * .18);
        const commit = event.type !== "touchcancel" && (distance >= threshold || (distance > 24 && performance.now() - startedAt < 250));
        const from = lastFold;
        const destination = { x: commit ? bounds.left + bounds.pageWidth + (direction === 1 ? -bounds.pageWidth : bounds.pageWidth) : anchor.x, y: anchor.y };
        core.userStop(lastFold, true);
        const began = performance.now();
        settling = true;
        // Finish from the held fold instead of restarting flipNext at a corner.
        const settle = (now: number) => {
          const progress = Math.min(1, (now - began) / 220);
          const eased = 1 - Math.pow(1 - progress, 3);
          core.getFlipController().fold({ x: from.x + (destination.x - from.x) * eased, y: from.y + (destination.y - from.y) * eased });
          if (progress < 1) settleFrame = requestAnimationFrame(settle);
          else { settling = false; core.getFlipController().stopMove(); }
        };
        settleFrame = requestAnimationFrame(settle);
      }
      origin = null;
      dragging = false;
    };
    element.addEventListener("touchstart", start, { capture: true, passive: false });
    element.addEventListener("click", click, true);
    element.addEventListener("dblclick", doubleClick, true);
    element.addEventListener("touchmove", move, { capture: true, passive: false });
    element.addEventListener("touchend", end, true);
    element.addEventListener("touchcancel", end, true);
    element.addEventListener("mousedown", mouseDown, true);
    window.addEventListener("mouseup", mouseUp, true);
    return () => {
      element.removeEventListener("touchstart", start, true);
      element.removeEventListener("click", click, true);
      element.removeEventListener("dblclick", doubleClick, true);
      observer.disconnect();
      element.removeEventListener("touchmove", move, true);
      element.removeEventListener("touchend", end, true);
      element.removeEventListener("touchcancel", end, true);
      element.removeEventListener("mousedown", mouseDown, true);
      window.removeEventListener("mouseup", mouseUp, true);
      cancelAnimationFrame(settleFrame);
      ownedEngine.current?.destroy();
    };
  }, [engine]);
  return <div ref={host} data-book-state="read" data-book-zoom="1.00" style={{ width: "100%", height: "100%", overflow: "hidden", touchAction: "none" }}><div ref={paper} style={{ width: "100%", height: "100%", transformOrigin: "center" }}><ReactFlipBook ref={bindEngine} width={450} height={800} size="stretch"
    minWidth={900} maxWidth={900} minHeight={100} maxHeight={1600}
    startPage={initialPage.current} autoSize={false} usePortrait
    showCover={false} flippingTime={650} maxShadowOpacity={0.35}
    mobileScrollSupport disableFlipByClick={false} showPageCorners={false}
    enableKeyboardNav={false} renderOnlyPageLengthChange
    onPageChange={onPageChange} style={{ width: "100%", height: "100%" }}>
    {children}
  </ReactFlipBook></div></div>;
});
