"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { BlockingSaveOverlay } from "@/src/components/bottom-sheet";
import { FormErrorDialog } from "@/src/components/form-error-dialog";

export function TripImportSettings({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  async function requestImport(selected: File) {
    const form = new FormData();
    form.set("file", selected);
    form.set("confirm", "true");
    const response = await fetch("/api/trips/import", { method: "POST", body: form });
    const data = await response.json().catch(() => {
      throw new Error("เซิร์ฟเวอร์ตอบกลับไม่สมบูรณ์หรือใช้เวลานาน กรุณาลองอัปโหลดไฟล์เดิมอีกครั้ง ระบบจะข้ามทริปที่บันทึกสำเร็จแล้ว");
    });
    if (!response.ok) throw new Error(data.error || "นำเข้าไม่สำเร็จ");
    return data;
  }
  async function chooseFile(selected: File | undefined) {
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setImporting(true);
    setError("");
    let navigating = false;
    try {
      if (!selected.name.toLowerCase().endsWith(".xlsx") || selected.size > 2 * 1024 * 1024) throw new Error("เลือกไฟล์ Excel (.xlsx) ขนาดไม่เกิน 2 MB");
      await requestImport(selected);
      onImported();
      // Fetch a fresh list, even if /trips was previously cached by the router.
      // Keep the overlay and submission lock until the destination loads.
      window.location.assign("/trips");
      navigating = true;
    } catch (error) { setError(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ"); }
    finally {
      if (!navigating) { lock.current = false; setBusy(false); setImporting(false); }
      if (input.current) input.current.value = "";
    }
  }
  async function downloadTemplate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/trips/import");
      if (!response.ok) throw new Error("ดาวน์โหลดเทมเพลตไม่สำเร็จ กรุณาลองใหม่");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "RouteRao-trip-template.xlsx";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : "ดาวน์โหลดไม่สำเร็จ"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <article className="card trip-import-settings">
      <div className="setting-label">
        <span className="stat-icon settings-feature-icon trip-import-icon"><FileSpreadsheet size={26} /></span>
        <div><strong>นำเข้าข้อมูลทริป</strong><small>1 แถวต่อ 1 ทริป</small></div>
      </div>
      <div className="trip-import-actions">
        <button type="button" className="secondary-btn" disabled={busy} onClick={downloadTemplate}><Download size={17} />ดาวน์โหลดเทมเพลต</button>
        <button type="button" className="primary-btn" disabled={busy} onClick={() => input.current?.click()}><Upload size={17} />อัปโหลดข้อมูล</button>
      </div>
      <input ref={input} hidden type="file" accept=".xlsx" onChange={event => void chooseFile(event.target.files?.[0])} />
      {busy && !importing && <p role="status">กำลังดาวน์โหลดเทมเพลต…</p>}
    </article>
    <BlockingSaveOverlay visible={importing} title="กำลังนำเข้าข้อมูลทริป…" description="กำลังตรวจสอบและบันทึกข้อมูล กรุณารอจนเสร็จโดยไม่ปิดหน้านี้" />
    {error && <FormErrorDialog title="นำเข้าข้อมูลทริป" description={error} onClose={() => setError("")} />}
  </>;
}
