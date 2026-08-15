"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function PdfPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
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
    <article className="pdf-viewer-page" aria-label={`หน้า ${pageNumber}`}>
      <span>หน้า {pageNumber}</span>
      {failed ? (
        <p>แสดงหน้านี้ไม่สำเร็จ</p>
      ) : (
        <canvas ref={canvasRef} />
      )}
    </article>
  );
}

function PdfDocument({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");

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

  if (error) return <p className="pdf-viewer-status error">{error}</p>;
  if (!pdf)
    return <p className="pdf-viewer-status">กำลังเปิด PDF ทุกหน้า…</p>;
  return (
    <div className="pdf-viewer-pages">
      {Array.from({ length: pdf.numPages }, (_, index) => (
        <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} />
      ))}
    </div>
  );
}

export function DocumentViewerPage({
  tripId,
  documentId,
  title,
  filename,
  mimeType,
}: {
  tripId: string;
  documentId: string;
  title: string;
  filename: string;
  mimeType: string;
}) {
  const router = useRouter();
  const fileUrl = `/api/trips/${tripId}/documents/${documentId}/file`;

  function backToDocuments() {
    router.replace(`/trips/${tripId}?workspace=documents`);
  }

  return (
    <main className="document-viewer document-route-viewer">
      <header className="document-viewer-header">
        <button
          type="button"
          className="icon-btn document-viewer-back"
          onClick={backToDocuments}
          aria-label="กลับไปหน้าเอกสาร"
        >
          <ChevronLeft size={19} />
        </button>
        <div>
          <strong id="document-viewer-title">{title}</strong>
          <small>{filename}</small>
        </div>
      </header>
      <div className="document-viewer-content">
        {mimeType === "application/pdf" ? (
          <PdfDocument url={fileUrl} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={title} />
        )}
      </div>
    </main>
  );
}
