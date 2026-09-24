"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type AttachmentMediaPreview = {
  url: string;
  title: string;
  mimeType: string;
  temporary?: boolean;
};

function PreviewPdfPage({
  pdf,
  pageNumber,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let renderTask:
      | { cancel: () => void; promise: Promise<void> }
      | undefined;
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (!active || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const viewport = page.getViewport({ scale: 1.75 });
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch((error) => {
        if (active && (error as Error).name !== "RenderingCancelledException")
          setFailed(true);
      });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf]);

  return (
    <article className="attachment-pdf-page" aria-label={`หน้า ${pageNumber}`}>
      <span>หน้า {pageNumber}</span>
      {failed ? <p>แสดงหน้านี้ไม่สำเร็จ</p> : <canvas ref={canvasRef} />}
    </article>
  );
}

function AttachmentPdfPreview({ url }: { url: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | {
        mode: "pan";
        pointerId: number;
        startX: number;
        startY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | {
        mode: "pinch";
        distance: number;
        scale: number;
        localX: number;
        localY: number;
        scrollLeft: number;
        scrollTop: number;
      }
    | null
  >(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);

  const distance = () => {
    const points = [...pointers.current.values()];
    return points.length < 2
      ? 0
      : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };
  const midpoint = () => {
    const points = [...pointers.current.values()];
    return points.length < 2
      ? { x: 0, y: 0 }
      : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  };
  const beginPinch = () => {
    const viewport = viewportRef.current;
    if (!viewport || pointers.current.size < 2) return;
    const center = midpoint();
    const rect = viewport.getBoundingClientRect();
    gesture.current = {
      mode: "pinch",
      distance: distance(),
      scale,
      localX: center.x - rect.left,
      localY: center.y - rect.top,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  };

  useEffect(() => {
    let active = true;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    void import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url, withCredentials: true });
        loadingTask = task;
        const loaded = await task.promise;
        if (active) setPdf(loaded);
        else await task.destroy();
      })
      .catch(() => {
        if (active) setError("เปิด PDF ไม่สำเร็จ");
      });
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [url]);

  if (error)
    return <p className="attachment-preview-status error">{error}</p>;
  if (!pdf)
    return <p className="attachment-preview-status">กำลังเปิด PDF…</p>;

  return (
    <div
      ref={viewportRef}
      className={`attachment-pdf-viewport${scale > 1 ? " is-zoomed" : ""}`}
      onPointerDown={(event) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointers.current.size >= 2) beginPinch();
        else {
          gesture.current = {
            mode: "pan",
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
          };
        }
      }}
      onPointerMove={(event) => {
        const viewport = viewportRef.current;
        if (!viewport || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const currentGesture = gesture.current;
        if (!currentGesture) return;
        if (pointers.current.size >= 2) {
          if (currentGesture.mode !== "pinch") {
            beginPinch();
            return;
          }
          if (currentGesture.distance <= 0) return;
          const nextScale = Math.max(
            1,
            Math.min(5, currentGesture.scale * (distance() / currentGesture.distance)),
          );
          const ratio = nextScale / currentGesture.scale;
          setScale(nextScale);
          requestAnimationFrame(() => {
            viewport.scrollLeft =
              (currentGesture.scrollLeft + currentGesture.localX) * ratio -
              currentGesture.localX;
            viewport.scrollTop =
              (currentGesture.scrollTop + currentGesture.localY) * ratio -
              currentGesture.localY;
          });
          return;
        }
        if (currentGesture.mode === "pan") {
          viewport.scrollLeft =
            currentGesture.scrollLeft - (event.clientX - currentGesture.startX);
          viewport.scrollTop =
            currentGesture.scrollTop - (event.clientY - currentGesture.startY);
        }
      }}
      onPointerUp={(event) => {
        const viewport = viewportRef.current;
        pointers.current.delete(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        const remaining = [...pointers.current.entries()][0];
        gesture.current = remaining && viewport
          ? {
              mode: "pan",
              pointerId: remaining[0],
              startX: remaining[1].x,
              startY: remaining[1].y,
              scrollLeft: viewport.scrollLeft,
              scrollTop: viewport.scrollTop,
            }
          : null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        gesture.current = null;
      }}
      onDoubleClick={() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        if (scale > 1) {
          setScale(1);
          viewport.scrollTo({ top: 0, left: 0 });
        } else setScale(2);
      }}
    >
      <div className="attachment-pdf-pages" style={{ width: `${scale * 100}%` }}>
        {Array.from({ length: pdf.numPages }, (_, index) => (
          <PreviewPdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} />
        ))}
      </div>
    </div>
  );
}

export function AttachmentPreviewOverlay({
  preview,
  onClose,
  closeLabel = "ปิดตัวอย่างเอกสาร",
}: {
  preview: AttachmentMediaPreview;
  onClose: () => void;
  closeLabel?: string;
}) {
  const imageViewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | {
        mode: "pan";
        pointerId: number;
        startX: number;
        startY: number;
        panX: number;
        panY: number;
      }
    | {
        mode: "pinch";
        distance: number;
        scale: number;
        contentX: number;
        contentY: number;
      }
    | null
  >(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const clampPan = (next: { x: number; y: number }, nextScale = scale) => {
    const viewport = imageViewportRef.current;
    if (!viewport || nextScale <= 1) return { x: 0, y: 0 };
    const limitX = (viewport.clientWidth * (nextScale - 1)) / 2;
    const limitY = (viewport.clientHeight * (nextScale - 1)) / 2;
    return {
      x: Math.max(-limitX, Math.min(limitX, next.x)),
      y: Math.max(-limitY, Math.min(limitY, next.y)),
    };
  };
  const pointerDistance = () => {
    const points = [...pointers.current.values()];
    return points.length < 2
      ? 0
      : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };
  const pointerMidpoint = () => {
    const points = [...pointers.current.values()];
    return points.length < 2
      ? { x: 0, y: 0 }
      : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  };
  const beginPinch = () => {
    const viewport = imageViewportRef.current;
    if (!viewport || pointers.current.size < 2) return;
    const midpoint = pointerMidpoint();
    const rect = viewport.getBoundingClientRect();
    gesture.current = {
      mode: "pinch",
      distance: pointerDistance(),
      scale,
      contentX: (midpoint.x - (rect.left + rect.width / 2) - pan.x) / scale,
      contentY: (midpoint.y - (rect.top + rect.height / 2) - pan.y) / scale,
    };
  };

  useEffect(() => {
    const root = document.documentElement;
    const wasLocked = root.classList.contains("sheet-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    root.classList.add("sheet-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      if (!wasLocked) root.classList.remove("sheet-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="attachment-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={preview.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <header>
        <strong>{preview.title}</strong>
        <button type="button" onClick={onClose} aria-label={closeLabel}>
          <X size={20} />
        </button>
      </header>
      <div className="attachment-preview-content">
        {preview.mimeType.startsWith("image/") ? (
          <div
            ref={imageViewportRef}
            className={`attachment-preview-image-viewport${scale > 1 ? " is-zoomed" : ""}`}
            onPointerDown={(event) => {
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              event.currentTarget.setPointerCapture(event.pointerId);
              if (pointers.current.size >= 2) {
                beginPinch();
              } else {
                gesture.current = {
                  mode: "pan",
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  panX: pan.x,
                  panY: pan.y,
                };
              }
            }}
            onPointerMove={(event) => {
              if (!pointers.current.has(event.pointerId)) return;
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              const currentGesture = gesture.current;
              if (!currentGesture) return;
              if (pointers.current.size >= 2) {
                if (currentGesture.mode !== "pinch") {
                  beginPinch();
                  return;
                }
                const viewport = imageViewportRef.current;
                if (!viewport || currentGesture.distance <= 0) return;
                const nextScale = Math.max(
                  1,
                  Math.min(5, currentGesture.scale * (pointerDistance() / currentGesture.distance)),
                );
                const midpoint = pointerMidpoint();
                const rect = viewport.getBoundingClientRect();
                const nextPan = clampPan(
                  {
                    x: midpoint.x - (rect.left + rect.width / 2) - currentGesture.contentX * nextScale,
                    y: midpoint.y - (rect.top + rect.height / 2) - currentGesture.contentY * nextScale,
                  },
                  nextScale,
                );
                setScale(nextScale);
                setPan(nextPan);
                return;
              }
              if (currentGesture.mode === "pan" && scale > 1) {
                setPan(
                  clampPan({
                    x: currentGesture.panX + event.clientX - currentGesture.startX,
                    y: currentGesture.panY + event.clientY - currentGesture.startY,
                  }),
                );
              }
            }}
            onPointerUp={(event) => {
              pointers.current.delete(event.pointerId);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              const remaining = [...pointers.current.entries()][0];
              gesture.current = remaining
                ? {
                    mode: "pan",
                    pointerId: remaining[0],
                    startX: remaining[1].x,
                    startY: remaining[1].y,
                    panX: pan.x,
                    panY: pan.y,
                  }
                : null;
            }}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              gesture.current = null;
            }}
            onDoubleClick={() => {
              if (scale > 1) {
                setScale(1);
                setPan({ x: 0, y: 0 });
              } else {
                setScale(2);
              }
            }}
          >
            <div
              className="attachment-preview-image-canvas"
              style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})` }}
            >
              <Image
                src={preview.url}
                alt={preview.title}
                fill
                sizes="100vw"
                unoptimized
                draggable={false}
              />
            </div>
          </div>
        ) : preview.mimeType.includes("pdf") ? (
          <AttachmentPdfPreview key={preview.url} url={preview.url} />
        ) : (
          <iframe src={preview.url} title={preview.title} />
        )}
      </div>
    </div>,
    document.body,
  );
}
