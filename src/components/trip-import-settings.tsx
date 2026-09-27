"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { FormErrorDialog } from "@/src/components/form-error-dialog";

type PreviewTrip = { name: string; code: string; destination: string; outboundDate: string; returnDate: string; expenseCount: number; totalThb: number; linkedPlanCount: number; stays: Array<{ name: string; nights: number; totalThb: number }>; flights: Array<{ name: string; departure: string; totalThb: number }>; plans: Array<{ name: string; date: string; time: string; costCount: number; totalThb: number }> };
const thb = (amount: number) => `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TripImportSettings({ onImported }: { onImported: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewTrip[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function requestImport(selected: File, confirm = false) {
    const form = new FormData();
    form.set("file", selected);
    form.set("confirm", String(confirm));
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
    setSuccess("");
    try {
      if (!selected.name.toLowerCase().endsWith(".xlsx") || selected.size > 2 * 1024 * 1024) throw new Error("เลือกไฟล์ Excel (.xlsx) ขนาดไม่เกิน 2 MB");
      const data = await requestImport(selected);
      setFile(selected);
      setPreview(data.trips);
    } catch (error) { setError(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ"); }
    finally { lock.current = false; setBusy(false); if (input.current) input.current.value = ""; }
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
        <div><strong>นำเข้าข้อมูลทริป</strong><small>ทริป ไทม์ไลน์ ค่าใช้จ่าย ที่พัก และเที่ยวบินในไฟล์เดียว</small></div>
      </div>
      <p>1 แถวต่อ 1 ทริป · สูงสุด 100 ทริปต่อไฟล์ · ขนาดไม่เกิน 2 MB</p>
      <p>กรอก 5 ชีต เชื่อมด้วยรหัสทริปที่ตั้งเอง ที่พักและเที่ยวบินจะสร้างรายการและค่าใช้จ่ายในไทม์ไลน์ให้อัตโนมัติ ไม่ต้องกรอกราคาซ้ำ</p>
      <p>ทุกชีตมีแถวตัวอย่างสีเหลืองที่ไม่นำเข้า เริ่มกรอกแถว 3 หรือคัดลอกแล้วเปลี่ยนรหัส __EXAMPLE__ เป็นรหัสทริปของคุณ · ที่พักและเที่ยวบินสูงสุดชีตละ 500 รายการ</p>
      <div className="trip-import-actions">
        <button type="button" className="secondary-btn" disabled={busy} onClick={downloadTemplate}><Download size={17} />ดาวน์โหลดเทมเพลต</button>
        <button type="button" className="primary-btn" disabled={busy} onClick={() => input.current?.click()}><Upload size={17} />อัปโหลดข้อมูล</button>
      </div>
      <input ref={input} hidden type="file" accept=".xlsx" onChange={event => void chooseFile(event.target.files?.[0])} />
      {busy && <p role="status">กำลังตรวจสอบไฟล์…</p>}
      {success && <div className="trip-import-success" role="status"><CheckCircle2 size={18} /><span>{success} <Link href="/trips" prefetch={false}>ดูทริปทั้งหมด</Link></span></div>}
    </article>
    {preview && <BottomSheet title={`นำเข้า ${preview.length} ทริป`} subtitle="ตรวจสอบรายการก่อนสร้างทริป" onClose={() => { if (!lock.current) { setPreview(null); setFile(null); } }} busy={busy} submitLabel={`ยืนยันสร้าง ${preview.length} ทริป`} onSubmit={async event => {
      event.preventDefault();
      if (!file || lock.current) return;
      lock.current = true; setBusy(true);
      try {
        const data = await requestImport(file, true);
        setSuccess(`สร้างสำเร็จ ${data.created} ทริป · ${data.plansCreated} รายการไทม์ไลน์ · ${data.expensesCreated} ค่าใช้จ่าย · ${data.staysCreated} ที่พัก · ${data.flightsCreated} เที่ยวบิน${data.skipped ? ` · ข้าม ${data.skipped} ทริปที่เคยนำเข้าแล้ว` : ""}`);
        setPreview(null); setFile(null);
        onImported(); router.refresh();
      } catch (error) { setError(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ"); }
      finally { lock.current = false; setBusy(false); }
    }}>
      <p className="field-hint">สร้างทริปใหม่พร้อมไทม์ไลน์และยอดใช้จริง ค่าใช้จ่ายเป็นของบัญชีคุณและแก้การหารภายหลังได้ ส่งไฟล์เดิมซ้ำจะข้ามทั้งทริป การแก้ไฟล์แล้วอัปโหลดเป็นการนำเข้าชุดใหม่</p>
      <p><strong>{preview.reduce((sum, trip) => sum + trip.plans.length + trip.linkedPlanCount, 0)} รายการไทม์ไลน์ · {preview.reduce((sum, trip) => sum + trip.expenseCount, 0)} ค่าใช้จ่าย</strong><br />{preview.reduce((sum, trip) => sum + trip.stays.length, 0)} ที่พัก · {preview.reduce((sum, trip) => sum + trip.flights.length, 0)} เที่ยวบิน<br />ยอดใช้จริงรวม {thb(preview.reduce((sum, trip) => sum + trip.totalThb, 0))}</p>
      <ol className="trip-import-preview">{preview.map((trip, index) => <li key={index}><strong>{trip.code && `${trip.code} · `}{trip.name}</strong><span>{trip.destination}</span><small>{trip.outboundDate} – {trip.returnDate}</small>
        <span>{trip.plans.length + trip.linkedPlanCount} รายการ · {trip.expenseCount} ค่าใช้จ่าย · {thb(trip.totalThb)}</span>
        {trip.stays.map((stay, index) => <small key={`stay-${index}`}>ที่พัก: {stay.name} · {stay.nights} คืน · {thb(stay.totalThb)}</small>)}
        {trip.flights.map((flight, index) => <small key={`flight-${index}`}>เที่ยวบิน: {flight.name} · {flight.departure.replace("T", " ")} · {thb(flight.totalThb)}</small>)}
        {trip.plans.length > 0 && <details><summary>ดูไทม์ไลน์ที่จะนำเข้า</summary><ul>{trip.plans.map((plan, index) => <li key={index}><strong>{plan.name}</strong><small>{plan.date} {plan.time} · {plan.costCount} ค่าใช้จ่าย · {thb(plan.totalThb)}</small></li>)}</ul></details>}
      </li>)}</ol>
    </BottomSheet>}
    {error && <FormErrorDialog title="นำเข้าข้อมูลทริป" description={error} onClose={() => setError("")} />}
  </>;
}
