"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, UsersRound } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { budgetAmountSatang, changeAllocation, distribute, effectiveAllocation, formatBudgetAmount, type BudgetAllocation } from "@/src/lib/budget-allocation";

export type BudgetPerson = { key: string; name: string; avatar: string | null };
const colors = ["#ff7315", "#149c91", "#5478d9", "#ad68d7", "#e05b86", "#b48b26", "#4c9d59", "#a56c52"];
const money = (value: number) => (value / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 });

export function BudgetAllocationSheet({ tripId, people, budget, saved, onSave, onClose }: {
  tripId: string; people: BudgetPerson[]; budget: number; saved?: BudgetAllocation | null;
  onSave: (allocation: BudgetAllocation | null) => void; onClose: () => void;
}) {
  const total = Math.max(0, Math.round(budget * 100));
  const scale = total || 10000;
  const [draft, setDraft] = useState(() => effectiveAllocation(saved, people.map(p => p.key), scale));
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null);
  const [selected, setSelected] = useState(people[0]?.key || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const percentages = distribute(10000, draft);
  const invalidAmount = editing !== null && budgetAmountSatang(editing.text) > total;
  const person = people.find(p => p.key === selected);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = root.current?.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.setAttribute("tabindex", "-1");
    dialog?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      const dialog = root.current?.querySelector('[role="dialog"]');
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus({ preventScroll: true }); }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus({ preventScroll: true }); }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); };
  }, [busy, onClose]);
  async function save(allocation: BudgetAllocation | null) {
    if (busy || (allocation && invalidAmount)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/budget-allocation`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allocation }), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSave(data.allocation);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }
  const chartPeople = [...people.filter(p => p.key === selected), ...people.filter(p => p.key !== selected)];
  const gradient = chartPeople.reduce<{ end: number; stops: string[] }>((result, p) => {
    const end = result.end + (draft[p.key] || 0) / scale * 100;
    return { end, stops: [...result.stops, `${colors[people.indexOf(p) % colors.length]} ${result.end}% ${end}%`] };
  }, { end: 0, stops: [] }).stops.join(",");
  const fraction = (draft[selected] || 0) / scale;
  const angle = fraction * Math.PI * 2 - Math.PI / 2;
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(dx, dy) < rect.width * .15) return;
    let fraction = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
    // Keep the 0/100 seam from jumping while dragging across twelve o'clock.
    if (fraction < .05 && (draft[selected] || 0) > scale * .9) fraction = 1;
    else if (fraction > .95 && (draft[selected] || 0) < scale * .1) fraction = 0;
    setEditing(null);
    setDraft(current => changeAllocation(current, selected, fraction * scale, scale));
  }
  if (people.length < 2) return null;
  return createPortal(<BottomSheet title={<><UsersRound size={20}/> งบรายคน</>} subtitle="แบ่งส่วนรับผิดชอบของสมาชิก รวม 100%" backdropRef={root} onClose={onClose} busy={busy} backdropClassName="budget-allocation-backdrop"
    className="budget-allocation-sheet" submitLabel={busy ? "กำลังบันทึก…" : "บันทึกสัดส่วน"} submitDisabled={busy || !people.length || invalidAmount}
    onSubmit={event => { event.preventDefault(); return save(draft); }}>
    <div className="budget-allocation-layout">
    <div className="budget-allocation-chart-panel">
    <div className="budget-allocation-chart" style={{ background: `conic-gradient(${gradient})` }}
      onPointerDown={event => { if (busy || people.length < 2) return; dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={move} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
      <div className="budget-allocation-chart-center"><span>งบรวม</span><strong>฿{money(total)}</strong><small>{person?.name}</small><b>{((percentages[selected] || 0) / 100).toFixed(2)}%</b></div>
      <span className="budget-allocation-handle" style={{ left: `${50 + Math.cos(angle) * 45}%`, top: `${50 + Math.sin(angle) * 45}%` }} />
    </div>
    <output className="budget-allocation-popover" aria-live="polite" aria-atomic="true"><span>งบของ {person?.name}</span><strong>฿{money(total ? draft[selected] || 0 : 0)}</strong></output>
    <p className="budget-allocation-help">เลือกคน แล้วลากวงกลมปรับสัดส่วน</p>
    <label className="budget-allocation-slider"><span className="sr-only">สัดส่วนของ {person?.name}</span>
      <input aria-label={`ปรับสัดส่วนของ ${person?.name || "สมาชิก"}`} type="range" min="0" max="10000" step="1" value={percentages[selected] || 0} disabled={busy || people.length < 2} onChange={event => { setEditing(null); setDraft(current => changeAllocation(current, selected, Number(event.target.value) / 10000 * scale, scale)); }} />
    </label>
    </div>
    <div className="budget-allocation-people">
      {people.map((p, index) => <div key={p.key} className={`budget-allocation-person ${selected === p.key ? "is-selected" : ""}`}>
        <button type="button" className="budget-allocation-identity" disabled={busy} onClick={() => setSelected(p.key)} aria-pressed={selected === p.key}>
          <span className="budget-allocation-avatar" style={{ borderColor: colors[index % colors.length], backgroundImage: p.avatar ? `url("${p.avatar}")` : undefined }}>{!p.avatar && <UserRound size={20}/>}</span>
          <span className="budget-allocation-person-copy"><strong>{p.name}</strong><small style={{ color: colors[index % colors.length] }}>{((percentages[p.key] || 0) / 100).toFixed(2)}%</small></span>
        </button>
        <label className="budget-allocation-amount"><span className="sr-only">งบของ {p.name}</span><span aria-hidden="true" className="budget-allocation-currency">฿</span><input aria-label={`งบของ ${p.name}`} inputMode="decimal" placeholder="0" disabled={busy || total <= 0 || people.length < 2}
          value={editing?.key === p.key ? editing.text : formatBudgetAmount(total > 0 ? (draft[p.key] || 0) / 100 : 0)}
          aria-invalid={editing?.key === p.key && invalidAmount}
          onFocus={event => { setSelected(p.key); setEditing({ key: p.key, text: event.target.value }); }}
          onChange={event => {
            const text = formatBudgetAmount(event.target.value);
            setEditing({ key: p.key, text });
            const amount = budgetAmountSatang(text);
            if (Number.isSafeInteger(amount) && amount <= total) setDraft(current => changeAllocation(current, p.key, amount, scale));
          }}
          onBlur={() => { if (!invalidAmount) setEditing(null); }} /></label>
      </div>)}
    </div>
    </div>
    {!total && <p className="budget-allocation-note">ยังไม่ได้ตั้งงบทริป แต่ตั้งเปอร์เซ็นต์เพื่อแบ่งค่าใช้จ่ายจริงได้</p>}
    <div className="budget-allocation-tools"><button type="button" disabled={busy} onClick={() => { setEditing(null); setDraft(effectiveAllocation(null, people.map(p => p.key), scale)); }}>แบ่งเท่ากัน</button>{saved && <button type="button" disabled={busy} onClick={() => void save(null)}>กลับไปหารตามรายการ</button>}</div>
    <p className="budget-allocation-note">ปรับคนหนึ่งแล้วส่วนที่เหลือจะแบ่งอัตโนมัติ · ตั้ง 0 สำหรับคนที่ไม่ต้องออก<br/>ใช้กับค่าใช้จ่ายทั้งทริป ยอดที่จ่ายแทนยังนำมาเคลียร์คืน</p>
    {invalidAmount && <p role="alert" className="workspace-error">งบรายคนต้องไม่เกินงบรวม ฿{money(total)}</p>}
    {error && <p role="alert" className="workspace-error">{error}</p>}
  </BottomSheet>, document.body);
}
