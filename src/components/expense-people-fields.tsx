"use client";
import type { Dispatch, SetStateAction, RefObject } from "react";
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
 return (
          <div className="expense-people-row">
          <div className="field split-member-field" ref={splitPickerRef}>
              <label>{t("หารค่าใช้จ่ายกับ")}</label>
              <button
                type="button"
                className={`split-member-trigger ${splitPickerOpen ? "is-open" : ""}`}
                onClick={() => setSplitPickerOpen((value) => !value)}
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
                          {!member.avatar_url && label.charAt(0).toUpperCase()}
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
                        <small className="split-guest-tag">{t("คนนอก")}</small>
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
                      aria-label={t("ชื่อคนนอกทริป")}
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
              <small>{t("เพิ่มคนนอกได้โดยไม่ต้องเชิญอีเมลหรือจอยทริป")}</small>
            </div>
            <div className="field expense-payer-field">
              <label htmlFor="expense-paid-by">{t("จ่ายโดย")}</label>
              <select id="expense-paid-by" name="paidBy" disabled={splitMembers.length + expenseGuests.length <= 1} required value={payerKey} onChange={event => setPayerKey(event.target.value)}>
                <option value="">{t("เลือกผู้จ่าย")}</option>
                <optgroup label={t("สมาชิกในทริป")}>
                  {splitMembers.map(member => <option key={member.id} value={`member:${member.id}`}>{member.display_name || member.email || "-"}</option>)}
                </optgroup>
                {expenseGuests.length > 0 && <optgroup label={t("คนนอกทริป")}>
                  {expenseGuests.map(guest => <option key={guest.id} value={`guest:${guest.id}`}>{guest.name}</option>)}
                </optgroup>}
              </select>
              <small>{t("ผู้ที่ออกเงินเต็มจำนวนให้ก่อน")}</small>
            </div>
          </div>

 );
}
