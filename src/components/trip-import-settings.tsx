"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { BlockingSaveOverlay } from "@/src/components/bottom-sheet";
import { FormErrorDialog } from "@/src/components/form-error-dialog";
import { ConfirmDialog } from "./bn-trip-app";
import { saveTripPlanDownload } from "@/src/lib/trip-plan-download";

export function TripImportSettings({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [downloadFile, setDownloadFile] = useState<File | null>(null);
  const [downloadError, setDownloadError] = useState("");
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
      const blob = await response.blob();
      setDownloadFile(new File([blob], "RouteRao-trip-template.xlsx", { type: blob.type }));
    } catch (error) { setDownloadError(error instanceof Error ? error.message : "ดาวน์โหลดไม่สำเร็จ"); throw error; }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <article className="card trip-import-settings">
      <div className="trip-import-heading">
      <div className="setting-label">
        <span className="stat-icon settings-feature-icon trip-import-icon"><FileSpreadsheet size={26} /></span>
        <div><strong>นำเข้าข้อมูลทริป</strong><small>1 แถวต่อ 1 ทริป</small></div>
      </div>
      <div className="trip-import-actions">
        <button type="button" className="secondary-btn" aria-label="ดาวน์โหลดเทมเพลต" title="ดาวน์โหลดเทมเพลต" disabled={busy} onClick={() => { setDownloadError(""); setConfirmDownload(true); }}><Download size={22} /></button>
        <button type="button" className="primary-btn" aria-label="อัปโหลดข้อมูล" title="อัปโหลดข้อมูล" disabled={busy} onClick={() => input.current?.click()}><Upload size={22} /></button>
      </div>
      </div>
      <input ref={input} hidden type="file" accept=".xlsx" onChange={event => void chooseFile(event.target.files?.[0])} />
      {busy && !importing && <p role="status">กำลังดาวน์โหลดเทมเพลต…</p>}
    </article>
    {(confirmDownload || downloadFile) && <ConfirmDialog key={downloadFile ? "save-template" : "prepare-template"} confirmation={{
      title: downloadFile ? "เทมเพลตพร้อมดาวน์โหลด" : "ดาวน์โหลดเทมเพลต?",
      description: downloadError || (downloadFile ? "กดบันทึกไฟล์ แล้วเลือกบันทึกไปยังไฟล์ในเมนูของเครื่อง หน้าแอปจะยังอยู่ที่เดิม" : "ดาวน์โหลดไฟล์ Excel สำหรับกรอกข้อมูลทริปเพื่อนำเข้า"),
      confirmLabel: downloadFile ? "บันทึกไฟล์" : "เตรียมไฟล์",
      busyLabel: downloadFile ? "กำลังบันทึก…" : "กำลังเตรียมไฟล์…",
      onConfirm: async () => {
        setDownloadError("");
        if (!downloadFile) return downloadTemplate();
        try { await saveTripPlanDownload(downloadFile); }
        catch (error) {
          if (!(error instanceof Error && error.name === "AbortError")) setDownloadError("บันทึกไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง");
          throw error;
        }
      },
    }} close={() => { setConfirmDownload(false); setDownloadError(""); if (downloadFile) setDownloadFile(null); }} />}
    <BlockingSaveOverlay visible={importing} title="กำลังนำเข้าข้อมูลทริป…" description="กำลังตรวจสอบและบันทึกข้อมูล กรุณารอจนเสร็จโดยไม่ปิดหน้านี้" />
    {error && <FormErrorDialog title="นำเข้าข้อมูลทริป" description={error} onClose={() => setError("")} />}
  </>;
}
