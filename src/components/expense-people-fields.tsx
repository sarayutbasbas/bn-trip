"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode, type RefObject } from "react";
import { ChevronDown, UserRound, Trash2, UserPlus, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { BottomSheet } from "./bottom-sheet";
type Person = { id: string; display_name: string | null; email: string | null; avatar_url: string | null; role?: "owner" | "collaborator" };
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

function PeopleSheet({ title, onClose, children, footer, payer = false }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; payer?: boolean }) {
 const backdropRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
   const previous = document.activeElement as HTMLElement | null;
   const root = backdropRef.current;
   root?.querySelector('[role="dialog"]')?.setAttribute("aria-label", title);
   root?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
   const keys = (event: KeyboardEvent) => {
     if (document.querySelector(".confirm-backdrop")) return;
     if (event.key === "Escape") {
       event.preventDefault(); event.stopImmediatePropagation(); onClose(); return;
     }
     if (event.key !== "Tab" || !root) return;
     const nodes = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
     const first = nodes[0], last = nodes[nodes.length - 1];
     if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
     else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
   };
   const viewport = window.visualViewport;
   const resize = () => {
     if (!root) return;
     root.style.height = `${viewport?.height ?? window.innerHeight}px`;
     root.style.top = `${viewport?.offsetTop ?? 0}px`;
   };
   resize();
   viewport?.addEventListener("resize", resize);
   viewport?.addEventListener("scroll", resize);
   document.addEventListener("keydown", keys, true);
   return () => {
     document.removeEventListener("keydown", keys, true);
     viewport?.removeEventListener("resize", resize);
     viewport?.removeEventListener("scroll", resize);
     previous?.focus({ preventScroll: true });
   };
 }, [onClose, title]);
 return createPortal(
   <BottomSheet title={title} onClose={onClose} backdropRef={backdropRef}
     backdropClassName="expense-people-backdrop" className="expense-people-sheet"
     bodyClassName="expense-people-sheet-body">
     <div className={`split-member-menu people-sheet-list ${payer ? "payer-member-menu" : ""}`}>{children}</div>
     <div className="people-sheet-footer">{footer}</div>
   </BottomSheet>, document.body,
 );
}

export function ExpensePeopleFields({ t, splitPickerRef, splitPickerOpen, setSplitPickerOpen, splitMemberIds, setSplitMemberIds, splitGuestIds, setSplitGuestIds, splitMembers, expenseGuests, guestName, setGuestName, addingGuest, addExpenseGuest, requestDeleteExpenseGuest, deletingGuestId, payerKey, setPayerKey }: Props) {
 const orderedMembers = [...splitMembers].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
 const allSplitMemberIds = orderedMembers.map(member => member.id);
 const [payerOpen, setPayerOpen] = useState(false);
 const people = [...orderedMembers.map(member => ({ key: `member:${member.id}`, label: member.display_name || member.email || "-", avatar: member.avatar_url })), ...expenseGuests.map(guest => ({ key: `guest:${guest.id}`, label: guest.name, avatar: null }))];
 const selectedPayer = people.find(person => person.key === payerKey);
 const closeSplit = useCallback(() => setSplitPickerOpen(false), [setSplitPickerOpen]);
 const closePayer = useCallback(() => setPayerOpen(false), [setPayerOpen]);
 const addPersonFooter = (
                  <div className="split-guest-add">
                    <UserPlus size={22} aria-hidden="true" />
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
                      {addingGuest ? <span aria-hidden="true">…</span> : <Plus size={22} aria-hidden="true" />}
                    </button>
                  </div>
 );
 return (
          <div className="expense-people-row">
          <div className="field split-member-field" ref={splitPickerRef}>
              <label>{t("หารค่าใช้จ่ายกับ")}</label>
              <button
                type="button"
                className={`split-member-trigger ${splitPickerOpen ? "is-open" : ""}`}
                onClick={() => { setPayerOpen(false); setSplitPickerOpen((value) => !value); }}
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
                <PeopleSheet title={t("หารค่าใช้จ่ายกับ")} onClose={closeSplit} footer={<>{addPersonFooter}<button type="button" className="primary-btn" onClick={closeSplit}>{t("เสร็จสิ้น")}</button></>}>
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
                  {orderedMembers.map((member) => {
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
                          {!member.avatar_url && <UserRound size={22}/>}
                        </span>
                        <span className="people-person-copy" title={label}>{label}</span>
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
                          <UserRound size={22} aria-hidden="true" />
                        </span>
                        <span className="people-person-copy" title={guest.name}>{guest.name}</span>
                      </label>
                      {requestDeleteExpenseGuest && <button
                        type="button"
                        className="split-guest-delete"
                        onClick={() => requestDeleteExpenseGuest(guest)}
                        disabled={Boolean(deletingGuestId)}
                        aria-label={`${t("ลบ")} ${guest.name}`}
                        title={t("ลบคนนอกทริป")}
                      >
                        <Trash2 size={20} aria-hidden="true" />
                      </button>}
                    </div>
                  ))}

                </PeopleSheet>
              )}
              <small>{t("เลือกคนที่หารรายการนี้ร่วมกัน")}</small>
            </div>
            <div className="field expense-payer-field split-member-field">
              <label htmlFor="expense-paid-by">{t("จ่ายโดย")}</label>
              <input type="hidden" name="paidBy" value={payerKey}/>
              <button id="expense-paid-by" type="button" className={`split-member-trigger ${payerOpen ? "is-open" : ""}`} disabled={people.length <= 1} aria-expanded={payerOpen} onClick={() => { setSplitPickerOpen(false); setPayerOpen(open => !open); }}><span>{selectedPayer?.label || t("เลือกผู้จ่าย")}</span><ChevronDown size={16}/></button>
              {payerOpen && <PeopleSheet title={t("จ่ายโดย")} onClose={closePayer} footer={addPersonFooter} payer>
                {people.map(person => <div className="split-guest-option" key={person.key}>
                  <label><input type="radio" name="expensePayerChoice" value={person.key} checked={payerKey === person.key} onChange={() => { setPayerKey(person.key); setPayerOpen(false); }}/><span className="split-checkmark" aria-hidden="true"/><span className="split-member-avatar" style={person.avatar ? { backgroundImage: `url("${person.avatar}")` } : undefined}>{!person.avatar && <UserRound size={22}/>}</span><span className="people-person-copy" title={person.label}>{person.label}</span></label>
                  {person.key.startsWith("guest:") && requestDeleteExpenseGuest && <button type="button" className="split-guest-delete" disabled={Boolean(deletingGuestId)} aria-label={`${t("ลบ")} ${person.label}`} onClick={() => { setPayerOpen(false); requestDeleteExpenseGuest({ id: person.key.slice(6), name: person.label }); }}><Trash2 size={20}/></button>}
                </div>)}
              </PeopleSheet>}
              <small>{t("ผู้ที่ออกเงินเต็มจำนวนให้ก่อน")}</small>
            </div>
          </div>

 );
}
