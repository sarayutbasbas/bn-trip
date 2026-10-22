"use client";

import { useEffect, useState } from "react";
import { Mail, Plus, UserCheck, UserRound, UsersRound, X } from "lucide-react";
import { useGuestRemoval } from "./guest-removal";
import { EXPENSE_GUESTS_CHANGED_EVENT } from "./use-expense-guests";

export type ParticipantModeValue = "email" | "name" | "member";

export function ParticipantMode({ value, onChange }: { value: ParticipantModeValue; onChange: (value: ParticipantModeValue) => void }) {
  return <div className="participant-modes" aria-label="วิธีเพิ่มผู้ร่วมทริป">
    <button type="button" className={value === "email" ? "active" : ""} aria-pressed={value === "email"} onClick={() => onChange("email")}><Mail size={18}/><span>เชิญอีเมล<small>ช่วยจัดการทริป</small></span></button>
    <button type="button" className={value === "name" ? "active" : ""} aria-pressed={value === "name"} onClick={() => onChange("name")}><UsersRound size={18}/><span>เพิ่มชื่อ<small>ไปด้วย ไม่ต้องมีบัญชี</small></span></button>
    <button type="button" className={value === "member" ? "active" : ""} aria-pressed={value === "member"} onClick={() => onChange("member")}><UserCheck size={18}/><span>สมาชิกไม่มีอีเมล<small>นับรวมค่าใช้จ่ายสมาชิก</small></span></button>
  </div>;
}

type NamedParticipant = { id: string; name: string; participant_type?: "guest" | "member" };

export function TripCompanions({ id, idea = false, editable, mode, onChanged }: { id: string; idea?: boolean; editable: boolean; mode: "name" | "member" | null; onChanged: () => void }) {
  const [people, setPeople] = useState<NamedParticipant[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/${idea ? "trip-ideas" : "trips"}/${id}/expense-guests`;
  const removal = useGuestRemoval({ id, idea, onRemoved: person => {
    setPeople(current => current.filter(item => item.id !== person.id));
    onChanged();
  } });
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
    if (saving || !name.trim() || !mode) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), participantType: mode === "member" ? "member" : "guest" }) });
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
    {editable && mode && <form className="companion-form" onSubmit={add}>
      <label htmlFor="companion-name">{mode === "member" ? "ชื่อสมาชิกที่ไม่มีอีเมล" : "ชื่อคนที่ไปด้วย"}</label>
      <div><input id="companion-name" maxLength={120} placeholder="เช่น พ่อ แม่ หรือชื่อเพื่อน" value={name} onChange={event => setName(event.target.value)} required/><button type="submit" className="primary-btn" disabled={saving || !name.trim()} aria-label="เพิ่มชื่อผู้ร่วมทริป"><Plus size={19}/>{saving ? "กำลังเพิ่ม…" : "เพิ่ม"}</button></div>
      <small>{mode === "member" ? `ไม่ส่งคำเชิญ แต่ถือเป็นสมาชิกและนับส่วนหารในยอดค่าใช้จ่าย${idea ? "เมื่อสร้างเป็นทริป" : "ทันที"}` : `ไม่ส่งคำเชิญและไม่มีสิทธิ์เข้าถึงทริป ใช้ชื่อนี้เลือกหารค่าใช้จ่ายและผู้จ่ายได้${idea ? "เมื่อสร้างเป็นทริป" : "ทันที"}`}</small>
    </form>}
    {error && <p role="alert" className="login-error">{error}</p>}
    {(people.length > 0 || Boolean(mode)) && <><h3>คนที่ไปด้วย <small>ไม่ใช้บัญชี · {people.length} คน</small></h3>
      {loading ? <p role="status">กำลังโหลดรายชื่อ…</p> : people.length ? <div className="companion-chips">{people.map(person => <span key={person.id} className={person.participant_type === "member" ? "is-offline-member" : ""}>{person.participant_type === "member" ? <UserCheck size={20}/> : <UserRound size={20}/>}<span>{person.name}<small>{person.participant_type === "member" ? "สมาชิก · นับค่าใช้จ่าย" : "ผู้ร่วมทริปแบบเพิ่มชื่อ"}</small></span>{editable && <button type="button" className="companion-remove" aria-label={`ลบ ${person.name}`} disabled={Boolean(removal.deletingId)} onClick={() => removal.requestRemoval(person)}><X size={16}/></button>}</span>)}</div> : <p className="collaborator-empty">เพิ่มชื่อคนที่ไปด้วยได้เลย</p>}</>}
    {removal.dialog}
  </section>;
}
