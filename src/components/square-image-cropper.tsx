"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";
import { optimizedCanvasFile } from "@/src/lib/client-image-compression";

const SIZE = 640;

export function SquareImageCropper({ file, onApply, onClose, circular = false }: {
  file: File;
  onApply: (cropped: File) => void;
  onClose: () => void;
  circular?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!circular) return;
    const previous = document.body.style.overflow;
    const focused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener("keydown", escape, true);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape, true);
      focused?.focus({ preventScroll: true });
    };
  }, [circular, onClose]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const source = new window.Image();
    source.onload = () => setImage(source);
    source.onerror = () => setError("ไม่สามารถอ่านไฟล์รูปนี้ได้");
    source.src = url;
    return () => {
      source.onload = null;
      source.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function clamp(next: { x: number; y: number }, nextZoom = zoom) {
    if (!image) return { x: 0, y: 0 };
    const scale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight) * nextZoom;
    const limitX = Math.max(0, (image.naturalWidth * scale - SIZE) / 2);
    const limitY = Math.max(0, (image.naturalHeight * scale - SIZE) / 2);
    return { x: Math.max(-limitX, Math.min(limitX, next.x)), y: Math.max(-limitY, Math.min(limitY, next.y)) };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.clearRect(0, 0, SIZE, SIZE);
    context.drawImage(image, (SIZE - width) / 2 + offset.x, (SIZE - height) / 2 + offset.y, width, height);
  }, [image, zoom, offset]);

  function distance() {
    const points = [...pointers.current.values()];
    return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      dragStart.current = null;
      pinchStart.current = { distance: distance(), zoom };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinchStart.current?.distance) {
      const nextZoom = Math.max(1, Math.min(3, pinchStart.current.zoom * distance() / pinchStart.current.distance));
      setZoom(nextZoom);
      setOffset(current => clamp(current, nextZoom));
      return;
    }
    const start = dragStart.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!start || !rect.width) return;
    const ratio = SIZE / rect.width;
    setOffset(clamp({ x: start.offsetX + (event.clientX - start.x) * ratio, y: start.offsetY + (event.clientY - start.y) * ratio }));
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pinchStart.current = null;
    const remaining = [...pointers.current.values()][0];
    dragStart.current = remaining ? { x: remaining.x, y: remaining.y, offsetX: offset.x, offsetY: offset.y } : null;
  }

  async function apply() {
    if (!canvasRef.current || !image || saving) return;
    setSaving(true);
    setError("");
    try {
      const cropped = await optimizedCanvasFile(canvasRef.current, file.name, {
        quality: 0.78, minQuality: 0.66, targetBytes: 180 * 1024, suffix: "accommodation",
      });
      onApply(cropped);
    } catch {
      setError("ไม่สามารถครอบรูปได้ กรุณาลองอีกครั้ง");
      setSaving(false);
    }
  }

  return createPortal(<div className="crop-editor" role="dialog" aria-modal="true" aria-label={circular ? "ครอบรูปโปรไฟล์" : "ครอบรูปที่พัก"}>
    <header>
      <button type="button" onClick={onClose} aria-label="ยกเลิก"><X size={20} /></button>
      <div><strong>{circular ? "ครอบรูปโปรไฟล์" : "ครอบรูปที่พัก"}</strong><small>ลากด้วยหนึ่งนิ้ว · จีบเข้า–ออกด้วยสองนิ้ว</small></div>
      <span />
    </header>
    <main><div className={`fixed-crop-frame is-square${circular ? " is-profile-circle" : ""}`}>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
      <span className="crop-gesture-hint">ลากเพื่อขยับ · จีบเพื่อซูม</span>
      {!circular && <span className="crop-ratio">1 : 1</span>}
    </div></main>
    <footer>
      {error && <p className="cover-error" role="alert">{error}</p>}
      <button type="button" className="crop-apply" onClick={() => void apply()} disabled={!image || saving}>
        <CheckCircle2 size={18} />{saving ? "กำลังครอบรูป…" : circular ? "บันทึกรูปโปรไฟล์" : "ยืนยันและกลับไปบันทึก"}
      </button>
    </footer>
  </div>, document.body);
}
