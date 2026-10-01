"use client";

import { Check, Users } from "lucide-react";
import type { TripFilterMember } from "@/src/lib/trip-member-filter";

export function TripMemberFilter({ members, selected, onChange }: {
  members: TripFilterMember[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  return <section className="trip-directory-filter-section">
    <h3>ผู้ร่วมทริป</h3>
    <div className={`trip-member-filter ${members.length + 1 > 4 ? "is-scrollable" : ""}`} role="group" aria-label="เลือกผู้ร่วมทริปได้หลายคน">
      <button type="button" aria-label="ผู้ร่วมทริปทุกคน" title="ทุกคน" aria-pressed={!selected.length} className={!selected.length ? "active" : ""} onClick={() => onChange([])}><Users size={24} /></button>
      {members.map(member => {
        const active = selected.includes(member.id);
        return <button type="button" key={member.id} aria-label={member.display_name} title={member.display_name} aria-pressed={active} className={active ? "active" : ""} onClick={() => onChange(active ? selected.filter(id => id !== member.id) : [...selected, member.id])}>
          <span className="trip-member-filter-avatar" style={member.avatar_url ? { backgroundImage: `url(${JSON.stringify(member.avatar_url)})` } : undefined}>{!member.avatar_url && (member.display_name || "?").charAt(0).toUpperCase()}</span>
          {active && <i><Check size={12} strokeWidth={3} /></i>}
        </button>;
      })}
    </div>
  </section>;
}
