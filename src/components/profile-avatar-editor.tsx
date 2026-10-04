"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { SquareImageCropper } from "./square-image-cropper";

export function ProfileAvatarEditor({ children, save }: { children: ReactNode; save: (file: File) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function upload(file: File) {
    setCrop(null); setBusy(true); setError(""); setDone(false);
    try { await save(file); setDone(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกรูปไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <div className="profile-avatar-editor">
    <button type="button" className="profile-avatar-upload" onClick={() => input.current?.click()} disabled={busy} aria-label="เปลี่ยนรูปโปรไฟล์" aria-busy={busy}>
      {children}<span className="profile-avatar-pencil"><Pencil size={15} /></span>
    </button>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      setError(""); setDone(false);
      if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { setError("รองรับ JPG, PNG และ WebP"); return; }
      if (file.size > 20 * 1024 * 1024) { setError("กรุณาเลือกรูปขนาดไม่เกิน 20 MB"); return; }
      setCrop(file);
    }} />
    {busy && <small role="status">กำลังบันทึก…</small>}
    {done && <small role="status">เปลี่ยนรูปแล้ว</small>}
    {error && <small role="alert">{error}</small>}
    {crop && <SquareImageCropper file={crop} circular onClose={() => setCrop(null)} onApply={file => void upload(file)} />}
  </div>;
}
