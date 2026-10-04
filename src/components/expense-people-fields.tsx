"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type RefObject } from "react";
import { ChevronDown, UserRound, Trash2, UserPlus, Plus } from "lucide-react";
type Person = { id: string; display_name: string | null; email: string | null; avatar_url: string | null };
type Guest = { id: string; name: string };
type Setter<T> = Dispatch<SetStateAction<T>>;
type Props = {
 t: (text: string) => string;
 splitPickerRef: RefObject<HTMLDivElement | null>;
 splitPickerOpen: boolean; setSplitPickerOpen: Setter<boolean>;
 splitMemberIds: string[]; setSplitMemberIds: Setter<string[]>;
 splitGuestIds: string[]; setSplitGuestIds: Setter<string[]>;
 splitMembers: Person[]; expenseGuests: Guest[];
 guestName: string; setGuestName: Setter<string>; addingGuest: boolean;
 addExpenseGuest: () => Promise<void>;
 requestDeleteExpenseGuest?: (guest: Guest) => void;
 deletingGuestId?: string | null;
 payerKey: string; setPayerKey: Setter<string>;
};

export function ExpensePeopleFields({ t, splitPickerRef, splitPickerOpen, setSplitPickerOpen, splitMemberIds, setSplitMemberIds, splitGuestIds, setSplitGuestIds, splitMembers, expenseGuests, guestName, setGuestName, addingGuest, addExpenseGuest, requestDeleteExpenseGuest, deletingGuestId, payerKey, setPayerKey }: Props) {
 const allSplitMemberIds = splitMembers.map(member => member.id);
 const [payerOpen, setPayerOpen] = useState(false);
 const [splitUp, setSplitUp] = useState(false);
 const [payerUp, setPayerUp] = useState(false);
 const opensUp = (element: HTMLElement | null) => {
   if (!element) return false;
   const box = element.getBoundingClientRect();
   const availableBelow = window.innerHeight - box.bottom - 90;
   return availableBelow < 250 && box.top > 300;
 };
 const payerRef = useRef<HTMLDivElement>(null);
 const people = [...splitMembers.map(member => ({ key: `member:${member.id}`, label: member.display_name || member.email || "-", avatar: member.avatar_url })), ...expenseGuests.map(guest => ({ key: `guest:${guest.id}`, label: guest.name, avatar: null }))];
 const selectedPayer = people.find(person => person.key === payerKey);
 useEffect(() => {
   if (!payerOpen) return;
   const outside = (event: PointerEvent) => { if (!payerRef.current?.contains(event.target as Node)) setPayerOpen(false); };
   const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setPayerOpen(false); };
   document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
   return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
 }, [payerOpen]);
 return (
          <div className="expense-people-row">
          <div className={`field split-member-field ${splitUp ? "people-menu-up" : ""}`} ref={splitPickerRef}>
              <label>{t("หารค่าใช้จ่ายกับ")}</label>
              <button
                type="button"
                className={`split-member-trigger ${splitPickerOpen ? "is-open" : ""}`}
                onClick={() => { setSplitUp(opensUp(splitPickerRef.current)); setPayerOpen(false); setSplitPickerOpen((value) => !value); }}
                aria-expanded={splitPickerOpen}
              >
                <span>
                  {splitMemberIds.length + splitGuestIds.length === 0
                    ? t("ยังไม่ได้เลือก")
                    : splitMemberIds.length + splitGuestIds.length ===
                        allSplitMemberIds.length + expenseGuests.length
                      ? t("ทุกคน")
                      : t(`${splitMemberIds.length + splitGuestIds.length} คน`)}
                </span>
                <ChevronDown size={16} />
              </button>
              {splitPickerOpen && (
                <div className="split-member-menu">
                  <label className="split-all-option">
                    <input
                      type="checkbox"
                      name="splitAll"
                      checked={
                        allSplitMemberIds.length > 0 &&
                        splitMemberIds.length === allSplitMemberIds.length &&
                        splitGuestIds.length === expenseGuests.length
                      }
                      onChange={(event) => {
                        setSplitMemberIds(
                          event.target.checked ? allSplitMemberIds : [],
                        );
                        setSplitGuestIds(
                          event.target.checked
                            ? expenseGuests.map((guest) => guest.id)
                            : [],
                        );
                      }}
                    />
                    <span className="split-checkmark" aria-hidden="true" />
                    <span>{t("ทุกคน")}</span>
                  </label>
                  {splitMembers.map((member) => {
                    const label = member.display_name || member.email || "-";
                    return (
                      <label key={member.id}>
                        <input
                          type="checkbox"
                          name="splitMember"
                          value={member.id}
                          checked={splitMemberIds.includes(member.id)}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...new Set([...splitMemberIds, member.id])]
                              : splitMemberIds.filter((id) => id !== member.id);
                            setSplitMemberIds(next);
                          }}
                        />
                        <span className="split-checkmark" aria-hidden="true" />
                        <span
                          className="split-member-avatar"
                          style={
                            member.avatar_url
                              ? {
                                  backgroundImage: `url("${member.avatar_url}")`,
                                }
                              : undefined
                          }
                        >
                          {!member.avatar_url && <UserRound size={16}/>}
                        </span>
                        <span>{label}</span>
                      </label>
                    );
                  })}
                  {expenseGuests.map((guest) => (
                    <div className="split-guest-option" key={guest.id}>
                      <label>
                        <input
                          type="checkbox"
                          name="splitGuest"
                          value={guest.id}
                          checked={splitGuestIds.includes(guest.id)}
                          onChange={(event) =>
                            setSplitGuestIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, guest.id])]
                                : current.filter((id) => id !== guest.id),
                            )
                          }
                        />
                        <span className="split-checkmark" aria-hidden="true" />
                        <span className="split-member-avatar is-guest">
                          <UserRound size={16} aria-hidden="true" />
                        </span>
                        <span>{guest.name}</span>
                        <small className="split-guest-tag">{t("เพิ่มด้วยชื่อ")}</small>
                      </label>
                      {requestDeleteExpenseGuest && <button
                        type="button"
                        className="split-guest-delete"
                        onClick={() => requestDeleteExpenseGuest(guest)}
                        disabled={Boolean(deletingGuestId)}
                        aria-label={`${t("ลบ")} ${guest.name}`}
                        title={t("ลบคนนอกทริป")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>}
                    </div>
                  ))}
                  <div className="split-guest-add">
                    <UserPlus size={17} aria-hidden="true" />
                    <input
                      type="text"
                      maxLength={120}
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        void addExpenseGuest();
                      }}
                      placeholder={t("เพิ่มชื่อ เช่น พ่อ แม่")}
                      aria-label={t("ชื่อผู้ร่วมทริป")}
                    />
                    <button
                      type="button"
                      onClick={() => void addExpenseGuest()}
                      disabled={!guestName.trim() || addingGuest}
                      aria-label={t(addingGuest ? "กำลังเพิ่ม…" : "เพิ่มคนนอกทริป")}
                      aria-busy={addingGuest}
                    >
                      {addingGuest ? <span aria-hidden="true">…</span> : <Plus size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              )}
              <small>{t("เลือกคนที่หารรายการนี้ร่วมกัน")}</small>
            </div>
            <div className={`field expense-payer-field split-member-field ${payerUp ? "people-menu-up" : ""}`} ref={payerRef}>
              <label htmlFor="expense-paid-by">{t("จ่ายโดย")}</label>
              <input type="hidden" name="paidBy" value={payerKey}/>
              <button id="expense-paid-by" type="button" className={`split-member-trigger ${payerOpen ? "is-open" : ""}`} disabled={people.length <= 1} aria-expanded={payerOpen} onClick={() => { setPayerUp(opensUp(payerRef.current)); setSplitPickerOpen(false); setPayerOpen(open => !open); }}><span>{selectedPayer?.label || t("เลือกผู้จ่าย")}</span><ChevronDown size={16}/></button>
              {payerOpen && <div className="split-member-menu payer-member-menu" role="group" aria-label={t("เลือกผู้จ่าย")}>
                {people.map(person => <label key={person.key}><input type="radio" name="expensePayerChoice" checked={payerKey === person.key} onChange={() => { setPayerKey(person.key); setPayerOpen(false); }}/><span className="split-checkmark" aria-hidden="true"/><span className="split-member-avatar" style={person.avatar ? { backgroundImage: `url("${person.avatar}")` } : undefined}>{!person.avatar && <UserRound size={16}/>}</span><span>{person.label}</span>{person.key.startsWith("guest:") && <small className="split-guest-tag">{t("เพิ่มด้วยชื่อ")}</small>}</label>)}
              </div>}
              <small>{t("ผู้ที่ออกเงินเต็มจำนวนให้ก่อน")}</small>
            </div>
          </div>

 );
}
