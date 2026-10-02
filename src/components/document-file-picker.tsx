"use client";

import { useEffect, useState, type Ref } from "react";
import Image from "next/image";
import { Check, FileText, Upload } from "lucide-react";
import { AttachmentPreviewOverlay } from "@/src/components/attachment-preview-overlay";

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
  existingFile,
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
  existingFile?: { url: string; name: string; mimeType: string };
}) {
  const [selectedFile,setSelectedFile]=useState<File|null>(null);
  const [objectUrl,setObjectUrl]=useState("");
  const [previewOpen,setPreviewOpen]=useState(false);
  useEffect(()=>()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)},[objectUrl]);
  const url=(fileName ? objectUrl : "")||existingFile?.url;
  const mimeType=(fileName ? selectedFile?.type : "")||existingFile?.mimeType||"";
  const displayName=fileName||existingFile?.name||"";
  return (
    <div className={`document-picker-with-preview ${url ? "has-file" : ""}`}>
      {url && <button type="button" className="document-picker-preview" aria-label={`ดูไฟล์ ${displayName}`} onClick={()=>setPreviewOpen(true)}>
        {mimeType.startsWith("image/") ? <Image src={url} alt={displayName} width={76} height={76} unoptimized/> : <FileText size={28}/>}
      </button>}
    <label
      className={`document-file-picker ${fileName ? "selected" : ""} ${className}`.trim()}
    >
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept={accept}
        onChange={(event) => {const file=event.target.files?.[0]||null;if(!file)return;setSelectedFile(file);setObjectUrl(URL.createObjectURL(file));onFileChange(file)}}
        required={required}
      />
      <span className="document-file-picker-icon">
        {url ? <Check size={22} /> : <Upload size={22} />}
      </span>
      <span>
        <strong>{url ? (mimeType.startsWith("image/") ? "เลือกรูปแล้ว" : "เลือกไฟล์แล้ว") : idleLabel}</strong>
        <small>{url ? "กดรูปเพื่อดู · กดที่นี่เพื่ออัปโหลดใหม่" : fileName ? selectedNote : idleNote}</small>
      </span>
    </label>
    {previewOpen && url && <AttachmentPreviewOverlay preview={{url,title:displayName,mimeType}} closeLabel="ปิดตัวอย่างเอกสาร" onClose={()=>setPreviewOpen(false)}/>}
    </div>
  );
}
