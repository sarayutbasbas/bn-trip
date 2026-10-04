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
    // public engine directly after horizontal intent so the paper follows now,
    // while vertical gestures still scroll the non-fullscreen page naturally.
    const start = (event: TouchEvent) => {
      event.stopImmediatePropagation();
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
        if (!core.getFlipController().start(origin)) { origin = null; return; }
        core.startUserTouch(origin);
        dragging = true;
      }
      if (dragging) { if (event.cancelable) event.preventDefault(); core.userMove(current, true); }
    };
    const end = (event: TouchEvent) => {
      event.stopImmediatePropagation();
      const current = point(event);
      const core = engine.current?.pageFlip();
      if (dragging && current && core) {
        if (event.type === "touchcancel" && origin) core.userMove(origin, true);
        const quickSwipe = event.type !== "touchcancel" && origin && performance.now() - startedAt < 250 && Math.abs(current.x - origin.x) > 30;
        core.userStop(current, !!quickSwipe);
        if (quickSwipe && origin) {
          if (current.x < origin.x) core.flipNext(); else core.flipPrev();
        }
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
