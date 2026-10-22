"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCheck, ListChecks, Trash2, X } from "lucide-react";
import { completeChecklistSelection, deleteChecklistSelection } from "@/src/lib/delete-checklist-selection";

export function useChecklistSelection() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return { active, setActive, selected, setSelected, busy, setBusy,
    toggle(id: string) { if (!busy) setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); },
    close() { if (!busy) { setActive(false); setSelected([]); } },
  };
}

export function ChecklistBulkDelete({ selection, visibleIds, allIds, itemUrl, onDeleted, onCompleted, onStart, scope }: {
  selection: ReturnType<typeof useChecklistSelection>;
  visibleIds: string[];
  allIds: string[];
  itemUrl: (id: string) => string;
  onDeleted: (ids: string[]) => void;
  onCompleted?: (ids: string[]) => void;
  onStart?: () => void;
  scope: "master" | "trip";
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const selected = selection.selected.filter(id => allIds.includes(id));
  const allVisible = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  useEffect(() => {
    if (!confirm) return;
    document.documentElement.classList.add("confirm-open");
    return () => document.documentElement.classList.remove("confirm-open");
  }, [confirm]);
  async function remove() {
    if (lock.current || !selected.length) return;
    lock.current = true;
    selection.setBusy(true);
    setError("");
    const { deleted, failed } = await deleteChecklistSelection(selected, itemUrl);
    if (deleted.length) onDeleted(deleted);
    selection.setSelected(failed);
    selection.setBusy(false);
    lock.current = false;
    setConfirm(false);
    if (failed.length) setError(`ลบไม่สำเร็จ ${failed.length} รายการ กรุณาลองอีกครั้ง`);
    else selection.setActive(false);
  }
  async function complete() {
    if (lock.current || !selected.length || !onCompleted) return;
    lock.current = true;
    selection.setBusy(true);
    setError("");
    const { completed, failed } = await completeChecklistSelection(selected, itemUrl);
    if (completed.length) onCompleted(completed);
    selection.setSelected(failed);
    selection.setBusy(false);
    lock.current = false;
    if (failed.length) setError(`ติ๊กไม่สำเร็จ ${failed.length} รายการ กรุณาลองอีกครั้ง`);
    else selection.setActive(false);
  }
  return <>
    <div className="checklist-bulk-toolbar">
      {!selection.active ? <button type="button" disabled={!allIds.length} onClick={() => { setError(""); onStart?.(); selection.setActive(true); }}><ListChecks size={18}/>เลือกรายการ</button> : <>
        <button type="button" disabled={selection.busy || !visibleIds.length} onClick={() => selection.setSelected(current => allVisible ? current.filter(id => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])])}>{allVisible ? "ยกเลิกที่แสดง" : "เลือกทั้งหมดที่แสดง"}</button>
        <span role="status">เลือก {selected.length} รายการ</span>
        {scope === "trip" && onCompleted ? <button type="button" className="checklist-bulk-complete" disabled={selection.busy || !selected.length} onClick={() => void complete()}><CheckCheck size={18}/>ติ๊กทั้งหมด ({selected.length})</button> : null}
        <button type="button" className="checklist-bulk-remove" disabled={selection.busy || !selected.length} onClick={() => setConfirm(true)}><Trash2 size={18}/>ลบ ({selected.length})</button>
        <button type="button" aria-label="ยกเลิกการเลือกรายการ" disabled={selection.busy} onClick={() => { selection.close(); setError(""); }}><X size={18}/></button>
      </>}
    </div>
    {error ? <p className="workspace-error" role="alert">{error}</p> : null}
    {confirm && createPortal(<div className="confirm-backdrop" onClick={event => { if (event.target === event.currentTarget && !selection.busy) setConfirm(false); }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`bulk-delete-${scope}`}>
        <span className="confirm-icon"><AlertTriangle size={22}/></span>
        <h2 id={`bulk-delete-${scope}`}>ลบ {selected.length} รายการ?</h2>
        <p>{scope === "master" ? "ลบรายการที่เลือกออกจาก Master Checklist โดยไม่ลบรายการที่เพิ่มไว้ในทริปแล้ว" : "ลบรายการที่เลือกออกจากทริปนี้ โดยไม่ลบรายการใน Master Checklist"}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" disabled={selection.busy} onClick={() => setConfirm(false)}>ยกเลิก</button>
          <button type="button" className="confirm-delete" disabled={selection.busy} onClick={() => void remove()}>{selection.busy ? "กำลังลบ…" : "ยืนยันลบ"}</button>
        </div>
      </div>
    </div>, document.body)}
  </>;
}

export function ChecklistSelectionBox({ selection, id, title }: { selection: ReturnType<typeof useChecklistSelection>; id: string; title: string }) {
  return <input className="checklist-select-box" type="checkbox" aria-label={`เลือก ${title}`} checked={selection.selected.includes(id)} disabled={selection.busy} onChange={() => selection.toggle(id)}/>;
}
