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
    const mouseDown = () => { mouseStartedHere = true; };
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
      if (dragging && origin) engine.current?.pageFlip()?.userStop(origin);
      origin = event.touches.length === 1 ? point(event) : null;
      dragging = false;
      startedAt = performance.now();
    };
    const move = (event: TouchEvent) => {
      event.stopImmediatePropagation();
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
    element.addEventListener("touchstart", start, { capture: true, passive: true });
    element.addEventListener("touchmove", move, { capture: true, passive: false });
    element.addEventListener("touchend", end, true);
    element.addEventListener("touchcancel", end, true);
    element.addEventListener("mousedown", mouseDown, true);
    window.addEventListener("mouseup", mouseUp, true);
    return () => {
      element.removeEventListener("touchstart", start, true);
      element.removeEventListener("touchmove", move, true);
      element.removeEventListener("touchend", end, true);
      element.removeEventListener("touchcancel", end, true);
      element.removeEventListener("mousedown", mouseDown, true);
      window.removeEventListener("mouseup", mouseUp, true);
      cancelAnimationFrame(settleFrame);
      ownedEngine.current?.destroy();
    };
  }, [engine]);
  return <div ref={host} data-book-state="read" style={{ width: "100%", height: "100%" }}><ReactFlipBook ref={bindEngine} width={450} height={800} size="stretch"
    minWidth={900} maxWidth={900} minHeight={100} maxHeight={1600}
    startPage={initialPage.current} autoSize={false} usePortrait
    showCover={false} flippingTime={650} maxShadowOpacity={0.35}
    mobileScrollSupport disableFlipByClick={false} showPageCorners={false}
    enableKeyboardNav={false} renderOnlyPageLengthChange
    onPageChange={onPageChange} style={{ width: "100%", height: "100%" }}>
    {children}
  </ReactFlipBook></div>;
});
