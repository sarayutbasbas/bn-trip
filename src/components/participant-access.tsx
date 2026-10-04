"use client";

import { LoaderCircle, Send } from "lucide-react";

export function ParticipantAccess({ value, onChange, disabled = false, allowAdmin = true, label = "สิทธิ์ผู้ร่วมทริป" }: {
  value: "admin" | "view";
  onChange: (value: "admin" | "view") => void;
  disabled?: boolean;
  allowAdmin?: boolean;
  label?: string;
}) {
  return <div className="participant-access-buttons" role="group" aria-label={label}>
    {(["admin", "view"] as const).map(access => <button type="button" key={access} aria-pressed={value === access} disabled={disabled || (access === "admin" && !allowAdmin)} onClick={() => onChange(access)}>{access === "admin" ? "Admin" : "View"}</button>)}
  </div>;
}

export function ParticipantInviteActions({ value, onChange, allowAdmin, busy, disabled }: {
  value: "admin" | "view";
  onChange: (value: "admin" | "view") => void;
  allowAdmin: boolean;
  busy: boolean;
  disabled: boolean;
}) {
  return <div className="participant-invite-actions">
    <ParticipantAccess value={value} onChange={onChange} allowAdmin={allowAdmin} disabled={busy}/>
    <button type="submit" className="primary-btn participant-send" disabled={disabled || busy} aria-label={busy ? "กำลังส่งคำเชิญ" : "ส่งคำเชิญ"} title="ส่งคำเชิญ" aria-busy={busy}>{busy ? <LoaderCircle size={20} className="participant-send-spinner"/> : <Send size={20}/>}</button>
  </div>;
}
