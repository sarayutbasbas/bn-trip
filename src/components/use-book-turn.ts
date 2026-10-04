"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";

type Turn = { from: number; to: number };
type ActiveTurn = Turn & { progress: number; phase: "drag" | "auto" | "settling" };
type Drag = { id: number; x: number; y: number; width: number; lastX: number; time: number; velocity: number; axis: "pending" | "horizontal" | "vertical"; moved: boolean };

/** Update only a CSS variable while dragging: no React render on each pointer move. */
export function useBookTurn(lastPage: number) {
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveTurn | null>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);

  const paint = useCallback((progress: number) => {
    if (!active.current) return;
    active.current.progress = Math.max(0, Math.min(1, progress));
    layer.current?.style.setProperty("--turn-progress", String(active.current.progress));
  }, []);

  const finish = useCallback((commit: boolean) => {
    const current = active.current;
    if (!current || current.phase === "settling") return;
    current.phase = "settling";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : Math.max(160, Math.round(360 * (commit ? 1 - current.progress : current.progress)));
    const complete = () => {
      if (commit) setPage(current.to);
      setTurn(null);
      active.current = null;
      timer.current = null;
    };
    if (!duration) { complete(); return; }
    // Start the settling transition at the last finger position, not from zero.
    if (layer.current) {
      layer.current.style.setProperty("--turn-duration", `${duration}ms`);
      void layer.current.offsetWidth;
    }
    frame.current = requestAnimationFrame(() => {
      if (layer.current) {
        layer.current.style.setProperty("--turn-duration", `${duration}ms`);
        void layer.current.offsetWidth;
      }
      paint(commit ? 1 : 0);
      timer.current = setTimeout(complete, duration + 40);
    });
  }, [paint]);

  const begin = useCallback((next: number, phase: "drag" | "auto") => {
    if (active.current || next === page || next < 0 || next > lastPage) return false;
    active.current = { from: page, to: next, progress: 0, phase };
    setTurn({ from: page, to: next });
    return true;
  }, [page, lastPage]);

  const changePage = useCallback((next: number) => {
    if (active.current || next === page || next < 0 || next > lastPage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPage(next); return; }
    begin(next, "auto");
  }, [begin, page, lastPage]);

  useLayoutEffect(() => {
    if (!turn || !active.current) return;
    paint(active.current.progress);
    if (active.current.phase === "auto") finish(true);
  }, [turn, paint, finish]);

  const cancel = useCallback(() => {
    if (drag.current) suppressClick.current = drag.current.moved;
    drag.current = null;
    finish(false);
  }, [finish]);

  useEffect(() => {
    // Rotation, interruption or backgrounding must never leave a held page stuck.
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden);
      if (timer.current) clearTimeout(timer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [cancel]);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) { cancel(); return; }
    if (active.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    suppressClick.current = false;
    if ((event.target as HTMLElement).closest("[data-book-control],a")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.clientWidth, lastX: event.clientX, time: event.timeStamp, velocity: 0, axis: "pending", moved: false };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) start.moved = suppressClick.current = true;
    if (start.axis === "pending" && start.moved) {
      start.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "horizontal" : "vertical";
      if (start.axis === "horizontal") {
        begin(page + (dx < 0 ? 1 : -1), "drag");
        // Capture after horizontal intent, so taps and vertical scrolling stay native.
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic tests / interrupted pointer. */ }
      }
    }
    if (start.axis !== "horizontal") return;
    event.preventDefault();
    const current = active.current;
    if (!current || current.phase !== "drag") return;
    const direction = current.to > current.from ? -1 : 1;
    const elapsed = Math.max(1, event.timeStamp - start.time);
    start.velocity = direction * (event.clientX - start.lastX) / elapsed;
    start.lastX = event.clientX;
    start.time = event.timeStamp;
    paint(direction * dx / Math.max(1, start.width * .85));
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const current = active.current;
    if (current?.phase === "drag") {
      const fastFlick = event.timeStamp - start.time < 100 && start.velocity > .55 && current.progress > .08;
      finish(current.progress >= .3 || fastFlick);
    }
    suppressClick.current = start.moved;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return { page, turn, layer, changePage, canTap: () => !active.current && !suppressClick.current, handlers: {
    onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp,
    onPointerCancel: cancel,
    onLostPointerCapture: () => { if (drag.current) cancel(); },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (event.detail === 0) suppressClick.current = false;
      else if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
    },
  } };
}
