"use client";

import { useState } from "react";
import { ConfirmDialog } from "./bn-trip-app";
import { EXPENSE_GUESTS_CHANGED_EVENT } from "./use-expense-guests";

export const GUEST_REMOVAL_DESCRIPTION = "ชื่อนี้จะหายจากผู้หารและผู้จ่ายของรายการที่เกี่ยวข้อง ระบบจะคำนวณส่วนหารใหม่ แต่รายการค่าใช้จ่ายและที่พักยังอยู่ หากเป็นผู้หารคนเดียว ยอดจะย้ายให้เจ้าของทริป และรายการที่ชื่อนี้เป็นผู้จ่ายจะต้องเลือกผู้จ่ายใหม่";
type Guest = { id: string; name: string };

export function useGuestRemoval({ id, idea = false, onRemoved }: { id: string; idea?: boolean; onRemoved: (guest: Guest) => void | Promise<void> }) {
  const [target, setTarget] = useState<Guest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestRemoval = (guest: Guest) => { setError(""); setTarget(guest); };
  const dialog = target ? <ConfirmDialog confirmation={{
    title: `ลบ “${target.name}” ออกจากทริป?`,
    description: `${idea ? "ชื่อนี้จะถูกนำออกจากผู้ร่วมวางแผนทริป โดยไม่ลบข้อมูลทริปหรือผู้ร่วมทริปคนอื่น" : GUEST_REMOVAL_DESCRIPTION}${error ? `\n${error}` : ""}`,
    confirmLabel: idea ? "ยืนยันการลบ" : "ลบและคำนวณใหม่",
    busyLabel: "กำลังลบ…",
    onConfirm: async () => {
      setDeletingId(target.id); setError("");
      try {
        const response = await fetch(`/api/${idea ? "trip-ideas" : "trips"}/${id}/expense-guests/${target.id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "ลบผู้ร่วมทริปไม่สำเร็จ กรุณาลองอีกครั้ง");
        if (!idea) window.dispatchEvent(new CustomEvent(EXPENSE_GUESTS_CHANGED_EVENT, { detail: { tripId: id } }));
        await onRemoved(target);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "ลบผู้ร่วมทริปไม่สำเร็จ");
        throw reason;
      } finally { setDeletingId(null); }
    },
  }} close={() => setTarget(null)}/> : null;
  return { requestRemoval, deletingId, dialog };
}
