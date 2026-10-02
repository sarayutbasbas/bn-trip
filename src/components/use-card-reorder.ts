"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type Slot = { id: string; x: number; y: number; width: number; height: number };
type Gesture = { id: string; pointerId: number; x: number; y: number; startX: number; startY: number; offsetX: number; offsetY: number; active: boolean };

function inserted<T extends { id: string }>(items: T[], source: string, target: string) {
  const from = items.findIndex(item => item.id === source), to = items.findIndex(item => item.id === target);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function useCardReorder<T extends { id: string }>(items: T[], save: (items: T[]) => Promise<void>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; width: number; height: number; x: number; y: number } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(items);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const slotRefs = useRef<Slot[]>([]);
  const targetRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const suppressClickUntil = useRef(0);
  const mounted = useRef(true);

  function cancel() {
    cleanupRef.current?.();
    setSelectedId(null); setDrag(null); setOverId(null); setSlots([]); setMessage("");
  }

  async function commit(source: string, target: string) {
    const next = inserted(items, source, target);
    cancel();
    if (next === items) return;
    setDraft(next); setSaving(true);
    try {
      await save(next);
      if (mounted.current) setMessage("บันทึกลำดับบัตรแล้ว");
    } catch (error) {
      console.error("[card-reorder] save failed", error instanceof Error ? error.message : "Unknown error");
      if (mounted.current) setMessage("บันทึกลำดับไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (saving || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    cleanupRef.current?.();
    slotRefs.current = [];
    const rect = event.currentTarget.closest<HTMLElement>(".saved-card-row")?.getBoundingClientRect();
    if (!rect) return;
    const current: Gesture = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, active: false };
    gesture.current = current;
    let frame = 0;
    const cleanup = () => {
      clearTimeout(hold); cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", aborted);
      window.removeEventListener("blur", aborted);
      window.removeEventListener("resize", aborted);
      window.removeEventListener("pagehide", aborted);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", visibility);
      gesture.current = null; cleanupRef.current = null;
    };
    const aborted = () => { if (current.active) suppressClickUntil.current = performance.now() + 400; cancel(); };
    const visibility = () => { if (document.hidden) aborted(); };
    const escape = (key: KeyboardEvent) => { if (key.key === "Escape") aborted(); };
    const draw = () => {
      frame = 0;
      if (!current.active || gesture.current !== current) return;
      if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${current.x - current.offsetX}px,${current.y - current.offsetY}px,0)`;
      const oldY = window.scrollY;
      const delta = current.y < 72 ? -8 : current.y > window.innerHeight - 96 ? 8 : 0;
      if (delta) window.scrollBy({ top: delta, behavior: "instant" });
      // Immutable document-space slots: transformed cards never influence hit testing.
      let closest: Slot | undefined, distance = Infinity;
      for (const slot of slotRefs.current) {
        const nextDistance = Math.hypot(current.x + window.scrollX - slot.x - slot.width / 2,
          current.y + window.scrollY - slot.y - slot.height / 2);
        if (nextDistance < distance) { closest = slot; distance = nextDistance; }
      }
      if (closest && targetRef.current !== closest.id) { targetRef.current = closest.id; setOverId(closest.id); }
      if (delta && window.scrollY !== oldY) frame = requestAnimationFrame(draw);
    };
    const move = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== current.pointerId) return;
      current.x = next.clientX; current.y = next.clientY;
      if (!current.active) {
        if (Math.hypot(current.x - current.startX, current.y - current.startY) > 10) cleanup();
        return;
      }
      if (next.cancelable) next.preventDefault();
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const up = (next: globalThis.PointerEvent) => {
      if (next.pointerId !== current.pointerId) return;
      if (!current.active) { cleanup(); return; }
      suppressClickUntil.current = performance.now() + 400;
      // A move and release can arrive in the same frame; use the final queued position.
      if (frame && slotRefs.current.length) { cancelAnimationFrame(frame); frame = 0; draw(); }
      // Finish immediately; don't retain any pointer or scroll listeners while saving.
      void commit(id, targetRef.current || id);
    };
    const hold = setTimeout(() => {
      current.active = true; targetRef.current = id;
      setSelectedId(id); setOverId(id); setDrag({ id, width: rect.width, height: rect.height, x: current.x-current.offsetX, y: current.y-current.offsetY });
      setMessage("ลากบัตรไปตำแหน่งที่ต้องการ แล้วยกนิ้วเพื่อบันทึก");
      // Measure once after the expanded grid is committed, never on each pointer move.
      frame = requestAnimationFrame(() => {
        if (gesture.current !== current) return;
        const measured = [...(gridRef.current?.querySelectorAll<HTMLElement>(".saved-card-row") || [])].map(row => {
          const bounds = row.getBoundingClientRect();
          return { id: row.dataset.cardId!, x: bounds.left + window.scrollX, y: bounds.top + window.scrollY, width: bounds.width, height: bounds.height };
        });
        slotRefs.current = measured; setSlots(measured); draw();
      });
    }, 350);
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", aborted);
    window.addEventListener("blur", aborted);
    window.addEventListener("resize", aborted);
    window.addEventListener("pagehide", aborted);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", visibility);
  }

  // Keyboard/screen-reader fallback: select the handle, then activate a destination.
  function select(id: string) {
    if (saving) return;
    setSelectedId(value => value === id ? null : id);
    setMessage("เลือกบัตรปลายทางเพื่อย้าย หรือกด Escape เพื่อยกเลิก");
  }
  function place(id: string) { if (selectedId && !saving && !drag) void commit(selectedId, id); }
  function canClick() { return !gesture.current?.active && performance.now() >= suppressClickUntil.current; }
  function rowStyle(id: string): CSSProperties | undefined {
    if (!drag || !overId || !slots.length) return;
    const reordered = inserted(slots, drag.id, overId);
    const from = slots.find(slot => slot.id === id), to = slots[reordered.findIndex(slot => slot.id === id)];
    if (!from || !to) return;
    return { transform: `translate(${to.x - from.x}px,${to.y - from.y}px)` };
  }
  useEffect(() => {
    mounted.current = true;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", escape);
    return () => { mounted.current = false; cleanupRef.current?.(); window.removeEventListener("keydown", escape); };
  }, []);
  return { selectedId, drag, gridRef, ghostRef, rowStyle, canClick, ordered: saving ? draft : items,
    saving, message, pointerDown, select, place, cancel };
}
