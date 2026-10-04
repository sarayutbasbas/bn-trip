"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, UserRound, UsersRound } from "lucide-react";
import { EXPENSE_GUESTS_CHANGED_EVENT } from "./use-expense-guests";

export function ParticipantMode({ value, onChange }: { value: "email" | "name"; onChange: (value: "email" | "name") => void }) {
  return <div className="participant-modes" aria-label="วิธีเพิ่มผู้ร่วมทริป">
    <button type="button" className={value === "email" ? "active" : ""} aria-pressed={value === "email"} onClick={() => onChange("email")}><Mail size={18}/><span>เชิญอีเมล<small>ช่วยจัดการทริป</small></span></button>
    <button type="button" className={value === "name" ? "active" : ""} aria-pressed={value === "name"} onClick={() => onChange("name")}><UsersRound size={18}/><span>เพิ่มชื่อ<small>ไปด้วย ไม่ต้องมีบัญชี</small></span></button>
  </div>;
}

export function TripCompanions({ id, idea = false, editable, showForm, onChanged }: { id: string; idea?: boolean; editable: boolean; showForm: boolean; onChanged: () => void }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/${idea ? "trip-ideas" : "trips"}/${id}/expense-guests`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดรายชื่อไม่สำเร็จ");
      setPeople(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url]);
  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เพิ่มผู้ร่วมทริปไม่สำเร็จ");
      setPeople(current => [...current.filter(person => person.id !== data.id), data]);
      setName("");
      if (!idea) window.dispatchEvent(new CustomEvent(EXPENSE_GUESTS_CHANGED_EVENT, { detail: { tripId: id } }));
      onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "เพิ่มผู้ร่วมทริปไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  return <section className="trip-companions">
    {editable && showForm && <form className="companion-form" onSubmit={add}>
      <label htmlFor="companion-name">ชื่อคนที่ไปด้วย</label>
      <div><input id="companion-name" maxLength={120} placeholder="เช่น พ่อ แม่ หรือชื่อเพื่อน" value={name} onChange={event => setName(event.target.value)} required/><button type="submit" className="primary-btn" disabled={saving || !name.trim()} aria-label="เพิ่มชื่อผู้ร่วมทริป"><Plus size={19}/>{saving ? "กำลังเพิ่ม…" : "เพิ่ม"}</button></div>
      <small>ไม่ส่งคำเชิญและไม่มีสิทธิ์เข้าถึงทริป ใช้ชื่อนี้เลือกหารค่าใช้จ่ายและผู้จ่ายได้{idea ? "เมื่อสร้างเป็นทริป" : "ทันที"}</small>
    </form>}
    {error && <p role="alert" className="login-error">{error}</p>}
    {(people.length > 0 || showForm) && <><h3>คนที่ไปด้วย <small>ไม่ใช้บัญชี · {people.length} คน</small></h3>
      {loading ? <p role="status">กำลังโหลดรายชื่อ…</p> : people.length ? <div className="companion-chips">{people.map(person => <span key={person.id}><UserRound size={20}/>{person.name}</span>)}</div> : <p className="collaborator-empty">เพิ่มชื่อคนที่ไปด้วยได้เลย</p>}</>}
  </section>;
}
