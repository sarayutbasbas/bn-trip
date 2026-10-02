"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Cloud, Database, Files, Gem, RefreshCw, Search, Users } from "lucide-react";
import { TripSectionHeading } from "./trip-section-heading";
import { FetchSkeleton } from "./fetch-skeleton";
import type { AccountStorageReport } from "@/src/lib/account-storage";

type Metric = { id: string; label: string; usedBytes: number | null; limitBytes: number | null; percent: number | null; status: string; detail: string; itemCount?: number };
type Providers = { metrics: Metric[]; updatedAt: string };
function bytes(value: number | null) {
  if (value === null) return "—";
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ${units[index]}`;
}

async function fetchAdminData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(28000)]) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
  return payload;
}
function requestError(reason: unknown) {
  return reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : "ใช้เวลานานเกินไป กรุณาลองอีกครั้ง";
}
function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const load = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setError("");
    try {
      const payload = await fetchAdminData<T>(url, controller.signal);
      if (!controller.signal.aborted) setData(payload);
    } catch (reason) {
      if (!controller.signal.aborted) setError(requestError(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController(); active.current = controller;
    fetchAdminData<T>(url, controller.signal)
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(reason => { if (!controller.signal.aborted) setError(requestError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => active.current?.abort();
  }, [url]);
  return { data, loading, error, load };
}

export function SystemOverviewPage() {
  const accounts = useAdminData<AccountStorageReport>("/api/admin/accounts-usage");
  const providers = useAdminData<Providers>("/api/admin/storage-usage");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return (accounts.data?.accounts || []).filter(account => `${account.displayName} ${account.email || ""}`.toLocaleLowerCase().includes(keyword));
  }, [accounts.data, search]);
  const busy = accounts.loading || providers.loading;
  const report = accounts.data;
  return <div className="app-shell flow-shell dashboard-page-shell master-page-shell system-page-shell">
    <main><div className="screen master-screen system-screen">
      <Link className="master-detail-back" href="/settings" aria-label="กลับหน้าตั้งค่า"><ArrowLeft size={21} /></Link>
      <TripSectionHeading className="master-detail-heading" title={<><Gem size={22} /> ภาพรวมระบบ</>} subtitle="บัญชีและพื้นที่จัดเก็บ · เฉพาะเจ้าของระบบ" actions={
        <button type="button" className="system-refresh" disabled={busy} aria-label="รีเฟรชภาพรวมระบบ" onClick={() => { void accounts.load(); void providers.load(); }}><RefreshCw size={19} className={busy ? "is-refreshing" : ""} /></button>
      } />
      {accounts.loading && !report ? <FetchSkeleton rows={3} label="กำลังอ่านข้อมูลบัญชีและพื้นที่…" /> : null}
      {accounts.error && <div className="system-error" role="alert"><p>{accounts.error}</p><button type="button" onClick={() => void accounts.load()} disabled={accounts.loading}>ลองอีกครั้ง</button></div>}
      {report && <>
        <div className="system-summary-grid" aria-label="ยอดรวมระบบ">
          <article className="card"><Users size={20} /><small>บัญชีทั้งหมด</small><strong>{report.totals.accounts.toLocaleString()} <span>บัญชี</span></strong><p>{report.totals.trips.toLocaleString()} ทริป · {report.totals.ideas.toLocaleString()} ทริปที่เล็งไว้</p></article>
          <article className="card"><Files size={20} /><small>ไฟล์ในระบบ{report.inventory.complete ? "" : " · บางส่วน"}</small><strong>{bytes(report.totals.fileBytes)}</strong><p>{report.inventory.available ? `${report.totals.fileCount.toLocaleString()} ไฟล์ · ${report.inventory.backend === "blob" ? "Vercel Blob" : "Local storage"}` : "ยังอ่านพื้นที่จัดเก็บไม่ได้"}</p></article>
        </div>
        {!report.inventory.complete && <p className="system-warning" role="status">ตรวจพื้นที่ไฟล์ยังไม่ครบ ตัวเลขที่อ่านได้เป็นเพียงบางส่วน ไม่ใช่ยอดรวมทั้งหมด กรุณารีเฟรชอีกครั้ง</p>}
      </>}
      <section className="card system-providers">
        <h2><Database size={19} /> พื้นที่ระบบ</h2>
        <p className="system-caption">Vercel · NeonDB · Blob</p>
        {providers.loading && !providers.data ? <FetchSkeleton rows={3} label="กำลังตรวจสอบบริการ…" /> : null}
        {providers.error && <div className="system-error" role="alert"><p>{providers.error}</p><button type="button" onClick={() => void providers.load()} disabled={providers.loading}>ลองอีกครั้ง</button></div>}
        <div className="storage-metric-list">{providers.data?.metrics.map(metric => <article key={metric.id} className={`storage-metric storage-${metric.status}`}>
          <div className="storage-metric-title"><span>{metric.id === "neon" ? <Database size={17} /> : <Cloud size={17} />}</span><div><strong>{metric.label}</strong><small>{metric.status === "unavailable" ? "ไม่พร้อมใช้งาน" : metric.status === "estimated" ? "ข้อมูลโดยประมาณ" : "ข้อมูลล่าสุด"}</small></div><b>{metric.percent === null ? "—" : `${metric.percent.toFixed(1)}%`}</b></div>
          <div className="storage-values"><strong>{bytes(metric.usedBytes)}</strong><span>จาก {bytes(metric.limitBytes)}</span></div>
          {metric.percent !== null && <div className="storage-progress" role="progressbar" aria-label={metric.label} aria-valuenow={Math.min(100, Math.max(0, metric.percent))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, metric.percent))}%` }} /></div>}
          <p>{metric.detail}</p>
        </article>)}</div>
      </section>
      {report && <section className="system-accounts">
        <h2><Users size={19} /> พื้นที่แต่ละบัญชี <span>({report.totals.accounts})</span></h2>
        <p className="system-caption">เรียงจากพื้นที่มากไปน้อย · นับตามเจ้าของทริป</p>
        <label className="master-search"><Search size={18} /><input aria-label="ค้นหาบัญชี" placeholder="ค้นหาชื่อหรืออีเมล" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="system-account-list">{filtered.map(account => <article className="card system-account" key={account.id}>
          <header><span className="system-account-avatar"><Users size={20} /></span><div><h3>{account.displayName}</h3><p>{account.email || "ไม่มีอีเมล"}</p></div></header>
          <small>{account.tripCount} ทริป · {account.ideaCount} ทริปที่เล็งไว้</small>
          <dl><div><dt>ข้อมูลระบบ ≈</dt><dd>{bytes(account.dataBytes)}</dd></div><div><dt>ไฟล์{!report.inventory.complete ? " (บางส่วน)" : ""}</dt><dd>{bytes(account.fileBytes)}</dd></div></dl>
          <footer>{account.fileCount} ไฟล์ที่ตรวจพบ{account.missingFileCount > 0 && <span> · ยังตรวจขนาดไม่ได้ {account.missingFileCount} ไฟล์</span>}</footer>
        </article>)}</div>
        {!filtered.length && <div className="card system-empty">{search ? "ไม่พบบัญชีที่ตรงกับคำค้นหา" : "ยังไม่มีบัญชีในระบบ"}</div>}
        <aside className="card system-method">
          <h3>ตัวเลขนี้นับอย่างไร?</h3>
          <p>ข้อมูลระบบ ≈ ผลรวมขนาดแถวข้อมูลของบัญชีและทริปที่เป็นเจ้าของ ไม่รวม index, พื้นที่ว่าง, ข้อมูลระบบและพื้นที่ส่วนกลาง จึงไม่เท่ากับ NeonDB ทั้งก้อน</p>
          <p>ไฟล์รวมรูปปก รูปแพลน ไทม์ไลน์ ที่พัก และเอกสารของทริป รวมถึงทริปที่เล็งไว้ ไฟล์เดียวกันในบัญชีเดียวไม่นับซ้ำ และไม่นับเพิ่มตามผู้ร่วมทริป</p>
          <p>ไฟล์ที่ยังจับคู่กับบัญชีไม่ได้: {bytes(report.totals.unmatchedBytes)} ({report.totals.unmatchedCount} ไฟล์) อาจเป็นไฟล์เก่าหรืออัปโหลดแล้วแต่ยังไม่บันทึก ไม่ได้ลบไฟล์เหล่านี้</p>
          {report.totals.sharedFileCount > 0 && <p>มี {report.totals.sharedFileCount} ไฟล์ใช้งานร่วมข้ามบัญชี แสดงในแต่ละบัญชีที่ใช้ แต่ยอดไฟล์ทั้งระบบนับเพียงครั้งเดียว</p>}
          <p>เป็นขนาดที่ตรวจพบ ไม่ใช่ยอดเรียกเก็บเงิน · รายการไฟล์อาจแคชสูงสุด 30 วินาที</p>
        </aside>
        <small className="storage-updated">อัปเดตล่าสุด {new Date(report.updatedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</small>
      </section>}
    </div></main>
  </div>;
}
