"use client";

import type { Ref } from "react";
import { Check, Upload } from "lucide-react";

export function DocumentFilePicker({
  fileName,
  inputRef,
  onFileChange,
  required = false,
  idleLabel = "เลือกรูปหรือไฟล์",
  idleNote = "รองรับ JPG, PNG, WebP และ PDF",
  selectedNote = "พร้อมอัปโหลดเมื่อกดบันทึก",
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  className = "",
}: {
  fileName: string;
  inputRef?: Ref<HTMLInputElement>;
  onFileChange: (file: File | null) => void;
  required?: boolean;
  idleLabel?: string;
  idleNote?: string;
  selectedNote?: string;
  accept?: string;
  className?: string;
}) {
  return (
    <label
      className={`document-file-picker ${fileName ? "selected" : ""} ${className}`.trim()}
    >
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept={accept}
        onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        required={required}
      />
      <span className="document-file-picker-icon">
        {fileName ? <Check size={22} /> : <Upload size={22} />}
      </span>
      <span>
        <strong>{fileName || idleLabel}</strong>
        <small>{fileName ? selectedNote : idleNote}</small>
      </span>
    </label>
  );
}
