"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEffect } from "react";

export type AttachmentMediaPreview = {
  url: string;
  title: string;
  mimeType: string;
  temporary?: boolean;
};

export function AttachmentPreviewOverlay({
  preview,
  onClose,
  closeLabel = "ปิดตัวอย่างเอกสาร",
}: {
  preview: AttachmentMediaPreview;
  onClose: () => void;
  closeLabel?: string;
}) {
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
    >
      <header>
        <strong>{preview.title}</strong>
        <button type="button" onClick={onClose} aria-label={closeLabel}>
          <X size={20} />
        </button>
      </header>
      <div className="attachment-preview-content">
        {preview.mimeType.startsWith("image/") ? (
          <Image
            src={preview.url}
            alt={preview.title}
            fill
            sizes="100vw"
            unoptimized
          />
        ) : (
          <iframe src={preview.url} title={preview.title} />
        )}
      </div>
    </div>,
    document.body,
  );
}
