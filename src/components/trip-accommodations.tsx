"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  ChevronDown,
  Clock,
  Coffee,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react";
import {
  accommodationResourceKey,
  loadClientResource,
  peekClientResource,
} from "@/src/lib/client-resource-cache";
import {
  BOOKING_PLATFORMS,
  type BookingPlatform,
  bookingPlatformByValue,
} from "@/src/lib/booking-platforms";

type Member = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};
type Card = {
  id: string;
  nickname: string;
  brand?: "visa" | "mastercard" | "jcb" | null;
  last_four: string;
  owner_name?: string;
  owner_email?: string | null;
};
type LocationOption = { name: string; address: string };
type Accommodation = {
  id: string;
  name: string;
  location: string;
  booking_platform: BookingPlatform | "";
  includes_breakfast: boolean;
  description: string;
  night_descriptions: Record<string, string>;
  check_in_day: number;
  check_out_day: number;
  check_in_time: string;
  check_out_time: string;
  foreign_amount: string;
  currency: string;
  exchange_rate: string;
  rate_date: string;
  payment_method: string;
  credit_card_id: string | null;
  payment_owner_name: string | null;
  split_member_ids: string[];
  cost_item_id: string;
  nights: number;
};

const currencyOptions = [
  ["THB", "บาท (THB)"],
  ["CNY", "หยวน (CNY)"],
  ["JPY", "เยน (JPY)"],
  ["USD", "ดอลลาร์สหรัฐ (USD)"],
  ["EUR", "ยูโร (EUR)"],
  ["GBP", "ปอนด์อังกฤษ (GBP)"],
  ["KRW", "วอนเกาหลี (KRW)"],
  ["SGD", "ดอลลาร์สิงคโปร์ (SGD)"],
  ["HKD", "ดอลลาร์ฮ่องกง (HKD)"],
  ["TWD", "ดอลลาร์ไต้หวัน (TWD)"],
  ["MYR", "ริงกิตมาเลเซีย (MYR)"],
  ["VND", "ดองเวียดนาม (VND)"],
  ["IDR", "รูเปียห์อินโดนีเซีย (IDR)"],
  ["PHP", "เปโซฟิลิปปินส์ (PHP)"],
  ["AUD", "ดอลลาร์ออสเตรเลีย (AUD)"],
  ["NZD", "ดอลลาร์นิวซีแลนด์ (NZD)"],
  ["CAD", "ดอลลาร์แคนาดา (CAD)"],
  ["CHF", "ฟรังก์สวิส (CHF)"],
  ["AED", "เดอร์แฮมสหรัฐอาหรับเอมิเรตส์ (AED)"],
  ["INR", "รูปีอินเดีย (INR)"],
] as const;
async function json<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "ทำรายการไม่สำเร็จ");
  return body as T;
}
function getAccommodationItems(tripId: string, force = false) {
  return loadClientResource(
    accommodationResourceKey(tripId),
    () =>
      json<Accommodation[]>(`/api/trips/${tripId}/accommodations`, {
        cache: "no-store",
      }),
    force,
  );
}
function money(value: number | string, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
function addDays(value: string, days: number) {
  const [year, month, date] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date) return "";
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}
function tripDateLabel(startDate: string, storedDay: number) {
  const value = addDays(startDate, storedDay - 1);
  if (!value) return "";
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
function moneyFormat(value: string | number) {
  const raw = String(value).replace(/[^\d.]/g, "");
  const [integer = "", ...decimals] = raw.split(".");
  const formatted = integer ? Number(integer).toLocaleString("en-US") : "";
  return decimals.length
    ? `${formatted}.${decimals.join("").slice(0, 2)}`
    : formatted;
}

function MoneyInput({ defaultValue }: { defaultValue?: string | number }) {
  const [value, setValue] = useState(() => moneyFormat(defaultValue ?? ""));
  return (
    <input
      name="price"
      inputMode="decimal"
      value={value}
      required
      onChange={(event) => setValue(moneyFormat(event.target.value))}
    />
  );
}
function NativeTimeInput({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  const [time, setTime] = useState(value);
  return (
    <label className="native-picker-control">
      <span className="native-picker-value">{time || "เลือกเวลา"}</span>
      <Clock size={18} aria-hidden="true" />
      <input
        aria-label={label}
        lang="th-TH-u-ca-gregory"
        name={name}
        type="time"
        value={time}
        required
        onChange={(event) => setTime(event.target.value)}
      />
    </label>
  );
}
function LocationSearch({
  options,
  defaultValue,
}: {
  options: LocationOption[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase();
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return options
      .filter((option) => {
        const key = option.address.trim().toLocaleLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return (
          !query ||
          (key !== query &&
            (key.includes(query) ||
              option.name.toLocaleLowerCase().includes(query)))
        );
      })
      .slice(0, 6);
  }, [options, query]);
  const visible = open && suggestions.length > 0;
  return (
    <div className="field trip-location-field">
      <label htmlFor="accommodation-location">โลเคชัน / ที่อยู่</label>
      <input
        id="accommodation-location"
        name="location"
        value={value}
        placeholder="ค้นหาหรือพิมพ์สถานที่ใหม่"
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-controls="accommodation-location-suggestions"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
      />
      {visible && (
        <div
          id="accommodation-location-suggestions"
          className="trip-location-suggestions"
          role="listbox"
        >
          {suggestions.map((option) => (
            <button
              key={option.address.toLocaleLowerCase()}
              type="button"
              role="option"
              aria-selected="false"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                setValue(option.address);
                setOpen(false);
              }}
            >
              <MapPin size={15} />
              <span>
                <strong>{option.address}</strong>
                {option.name !== option.address && <small>{option.name}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function BookingPlatformPicker({
  value,
  onChange,
}: {
  value: BookingPlatform | "";
  onChange: (value: BookingPlatform) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = bookingPlatformByValue(value);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !pickerRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div className="field accommodation-booking-field" ref={pickerRef}>
      <label>จองจากแอป</label>
      <button
        type="button"
        className={`booking-platform-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <Image src={selected.icon} alt="" width={40} height={24} />
        ) : (
          <span className="booking-platform-placeholder">เลือก</span>
        )}
        <strong>{selected?.label || "เลือกแอป"}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="split-member-menu booking-platform-menu" role="listbox">
          {BOOKING_PLATFORMS.map((option) => (
            <label key={option.value}>
              <input
                type="radio"
                name="bookingPlatform"
                value={option.value}
                checked={value === option.value}
                onChange={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              />
              <span className="split-checkmark" aria-hidden="true" />
              <Image src={option.icon} alt="" width={42} height={25} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
function CardLogo({ brand }: { brand?: Card["brand"] }) {
  const label =
    brand === "visa"
      ? "VISA"
      : brand === "mastercard"
        ? "Mastercard"
        : brand === "jcb"
          ? "JCB"
          : "Credit card";
  return (
    <span
      className={`card-brand-logo accommodation-card-brand card-brand-${brand || "generic"}`}
      role="img"
      aria-label={label}
    />
  );
}

export function TripAccommodations({
  tripId,
  totalDays,
  hasDayZero = false,
  startDate,
  members,
  cards,
  locations,
  openAccommodationId,
  openAccommodationDay,
  onAccommodationOpened,
  overlayOnly = false,
  refreshToken = 0,
  canDelete,
  notify,
  onChanged,
}: {
  tripId: string;
  totalDays: number;
  hasDayZero?: boolean;
  startDate: string;
  members: Member[];
  cards: Card[];
  locations: LocationOption[];
  openAccommodationId?: string | null;
  openAccommodationDay?: number | null;
  onAccommodationOpened?: () => void;
  overlayOnly?: boolean;
  refreshToken?: number;
  canDelete: boolean;
  notify: (message: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const displayDay = (day: number) => day - Number(hasDayZero);
  const cachedItems = peekClientResource<Accommodation[]>(
    accommodationResourceKey(tripId),
  );
  const [items, setItems] = useState<Accommodation[]>(() => cachedItems || []);
  const [loading, setLoading] = useState(!cachedItems);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Accommodation | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Accommodation | null>(null);
  const [checkInDay, setCheckInDay] = useState(1);
  const [checkOutDay, setCheckOutDay] = useState(Math.min(2, totalDays + 1));
  const [nightDescriptions, setNightDescriptions] = useState<
    Record<string, string>
  >({});
  const [focusedDetailDay, setFocusedDetailDay] = useState<number | null>(null);
  const [currency, setCurrency] = useState("THB");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [rateDate, setRateDate] = useState(startDate);
  const [rateEstimated, setRateEstimated] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [bookingPlatform, setBookingPlatform] = useState<BookingPlatform | "">(
    "agoda",
  );
  const [paymentSource, setPaymentSource] = useState("cash");
  const allMemberIds = useMemo(
    () => members.map((member) => member.id),
    [members],
  );
  const [splitMemberIds, setSplitMemberIds] = useState<string[]>(allMemberIds);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const splitPickerRef = useRef<HTMLDivElement>(null);
  const handledRefreshToken = useRef(refreshToken);
  async function load(force = true, showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      setItems(await getAccommodationItems(tripId, force));
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลที่พักไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      const cached = peekClientResource<Accommodation[]>(
        accommodationResourceKey(tripId),
      );
      if (cached) {
        setItems(cached);
        setError("");
        setLoading(false);
        return;
      }
      setItems([]);
      setLoading(true);
      void getAccommodationItems(tripId)
        .then((nextItems) => {
          if (!active) return;
          setItems(nextItems);
          setError("");
        })
        .catch((reason) => {
          if (!active) return;
          setError(
            reason instanceof Error
              ? reason.message
              : "โหลดข้อมูลที่พักไม่สำเร็จ",
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [tripId]);
  useEffect(() => {
    if (
      refreshToken <= 0 ||
      handledRefreshToken.current === refreshToken
    )
      return;
    handledRefreshToken.current = refreshToken;
    let active = true;
    void getAccommodationItems(tripId, true)
      .then((nextItems) => {
        if (!active) return;
        setItems(nextItems);
        setError("");
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "โหลดข้อมูลที่พักไม่สำเร็จ",
        );
      });
    return () => {
      active = false;
    };
  }, [refreshToken, tripId]);
  useEffect(() => {
    if (!splitPickerOpen) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !splitPickerRef.current?.contains(event.target)
      )
        setSplitPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [splitPickerOpen]);
  function openNew() {
    setCheckInDay(1);
    setCheckOutDay(2);
    setNightDescriptions({});
    setFocusedDetailDay(null);
    setCurrency("THB");
    setExchangeRate(1);
    setRateDate(startDate);
    setRateEstimated(false);
    setBookingPlatform("agoda");
    setPaymentSource("cash");
    setSplitMemberIds(allMemberIds);
    setSplitPickerOpen(false);
    setEditing("new");
  }
  function openEdit(item: Accommodation, detailDay: number | null = null) {
    setCheckInDay(item.check_in_day);
    setCheckOutDay(item.check_out_day);
    setNightDescriptions(
      Object.fromEntries(
        Array.from(
          { length: item.check_out_day - item.check_in_day },
          (_, index) => item.check_in_day + index,
        ).map((day) => [
          String(day),
          item.night_descriptions?.[String(day)] ?? item.description ?? "",
        ]),
      ),
    );
    setFocusedDetailDay(
      detailDay !== null &&
        detailDay >= item.check_in_day &&
        detailDay < item.check_out_day
        ? detailDay
        : null,
    );
    setCurrency(item.currency);
    setExchangeRate(Number(item.exchange_rate || 1));
    setRateDate(String(item.rate_date || startDate).slice(0, 10));
    setRateEstimated(false);
    setBookingPlatform(item.booking_platform || "");
    setPaymentSource(item.credit_card_id || "cash");
    const validIds = (item.split_member_ids || []).filter((id) =>
      allMemberIds.includes(id),
    );
    setSplitMemberIds(validIds.length ? validIds : allMemberIds);
    setSplitPickerOpen(false);
    setEditing(item);
  }
  useEffect(() => {
    if (!openAccommodationId || loading) return;
    const item = items.find((value) => value.id === openAccommodationId);
    if (!item) return;
    const frame = requestAnimationFrame(() => {
      openEdit(item, openAccommodationDay ?? null);
      onAccommodationOpened?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [openAccommodationId, openAccommodationDay, loading, items]); // eslint-disable-line react-hooks/exhaustive-deps
  async function loadRate(nextCurrency: string, day: number) {
    setCurrency(nextCurrency);
    const date = addDays(startDate, day - 1);
    setRateDate(date);
    if (nextCurrency === "THB") {
      setExchangeRate(1);
      setRateEstimated(false);
      return;
    }
    setRateLoading(true);
    try {
      const result = await json<{
        rate: number;
        date: string;
        estimated?: boolean;
      }>(`/api/exchange-rate?currency=${nextCurrency}&date=${date}`);
      setExchangeRate(Number(result.rate));
      setRateDate(result.date);
      setRateEstimated(Boolean(result.estimated));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "โหลดอัตราแลกเปลี่ยนไม่สำเร็จ",
      );
    } finally {
      setRateLoading(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const selectedCard = cards.find((card) => card.id === paymentSource);
    const foreignAmount = Number(
      String(form.get("price") || "0").replace(/,/g, ""),
    );
    if (!Number.isFinite(foreignAmount) || foreignAmount < 0) {
      setError("กรุณากรอกยอดเงินให้ถูกต้อง");
      return;
    }
    if (checkOutDay <= checkInDay) {
      setError("วันเช็กเอาต์ต้องอยู่หลังวันเช็กอิน");
      return;
    }
    if (members.length && !splitMemberIds.length) {
      setError("กรุณาเลือกผู้ร่วมทริปอย่างน้อย 1 คน");
      return;
    }
    const body = {
      name: String(form.get("name") || ""),
      location: String(form.get("location") || ""),
      bookingPlatform,
      includesBreakfast: form.get("includesBreakfast") === "true",
      description: nightDescriptions[String(checkInDay)]?.trim() || "",
      nightDescriptions: Object.fromEntries(
        Array.from(
          { length: checkOutDay - checkInDay },
          (_, index) => checkInDay + index,
        ).map((day) => [
          String(day),
          (nightDescriptions[String(day)] || "").trim(),
        ]),
      ),
      checkInDay,
      checkOutDay,
      checkInTime: String(form.get("checkInTime") || "15:00"),
      checkOutTime: String(form.get("checkOutTime") || "11:00"),
      foreignAmount,
      currency,
      exchangeRate,
      rateDate: String(rateDate || startDate).slice(0, 10),
      paymentMethod: selectedCard
        ? `${selectedCard.owner_name ? `${selectedCard.owner_name} · ` : ""}${selectedCard.nickname} · x-${selectedCard.last_four}`
        : "เงินสด",
      creditCardId: selectedCard?.id || null,
      paymentOwnerName:
        selectedCard?.owner_name || selectedCard?.owner_email || null,
      splitMemberIds,
    };
    setSaving(true);
    setError("");
    try {
      const isNew = editing === "new";
      await json(
        isNew
          ? `/api/trips/${tripId}/accommodations`
          : `/api/trips/${tripId}/accommodations/${editing.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setEditing(null);
      await Promise.all([load(), onChanged()]);
      notify(
        isNew
          ? "เพิ่มที่พักใน Timeline และค่าใช้จ่ายแล้ว"
          : "อัปเดตที่พัก Timeline และค่าใช้จ่ายแล้ว",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกที่พักไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await json(`/api/trips/${tripId}/accommodations/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setEditing(null);
      await Promise.all([load(), onChanged()]);
      notify("ลบที่พักออกจาก Timeline และค่าใช้จ่ายแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบที่พักไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  if (totalDays <= 1) return null;
  const edit = editing === "new" ? null : editing;
  const detailDays =
    focusedDetailDay !== null &&
    focusedDetailDay >= checkInDay &&
    focusedDetailDay < checkOutDay
      ? [focusedDetailDay]
      : Array.from(
          { length: checkOutDay - checkInDay },
          (_, index) => checkInDay + index,
        );
  return (
    <section
      className={`accommodation-panel ${overlayOnly ? "accommodation-overlay-only" : ""}`}
    >
      {!overlayOnly && (
        <div className="toolbar expense-toolbar">
          <div>
            <h2>ที่พักของทริป</h2>
            <p className="page-sub">
              จองครั้งเดียว แสดงทุกคืนใน Timeline และรวมในค่าใช้จ่ายอัตโนมัติ
            </p>
          </div>
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      {!overlayOnly &&
        (loading ? (
          <div className="card accommodation-empty">กำลังโหลดที่พัก…</div>
        ) : items.length ? (
          <div className="accommodation-list">
            {items.map((item) => {
              const isBaht = item.currency === "THB";
              const bahtAmount =
                Number(item.foreign_amount) * Number(item.exchange_rate || 1);
              const bookingPlatform = bookingPlatformByValue(
                item.booking_platform,
              );
              return (
                <button
                  type="button"
                  className="accommodation-card"
                  key={item.id}
                  onClick={() => openEdit(item)}
                >
                  <span className="accommodation-card-copy">
                    <strong>{item.name}</strong>
                    <small>
                      <MapPin size={12} />
                      {item.location || "ยังไม่ได้ระบุโลเคชัน"}
                    </small>
                    <small>
                      <CalendarDays size={12} />
                      {tripDateLabel(startDate, item.check_in_day)} –{" "}
                      {tripDateLabel(startDate, item.check_out_day)}
                    </small>
                    <small>
                      Day {displayDay(item.check_in_day)}–
                      {displayDay(item.check_out_day)} · {item.nights} คืน
                      {bookingPlatform
                        ? ` · จองผ่าน ${bookingPlatform.label}`
                        : ""}
                    </small>
                  </span>
                  <span className="accommodation-card-price">
                    {!isBaht && (
                      <small>{money(item.foreign_amount, item.currency)}</small>
                    )}
                    <strong>
                      {isBaht ? "" : "≈ "}
                      {money(isBaht ? item.foreign_amount : bahtAmount)}
                    </strong>
                    <small>{item.payment_method}</small>
                    <i>
                      <Pencil size={14} />
                    </i>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card accommodation-empty">
            <span>
              <BedDouble size={25} />
            </span>
            <strong>ยังไม่ได้เพิ่มที่พัก</strong>
            <p>
              เพิ่มชื่อ โลเคชัน ช่วงวันที่พัก และราคา ระบบจะเชื่อมให้ทุกหน้า
            </p>
          </div>
        ))}
      {!overlayOnly && (
        <button
          className="directory-fab accommodation-fab"
          type="button"
          onClick={openNew}
        >
          <Plus size={22} />
          <span>เพิ่มที่พัก</span>
        </button>
      )}
      {editing && (
        <div
          className="modal-backdrop flight-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setEditing(null);
          }}
        >
          <form
            className="modal cost-sheet flight-sheet accommodation-sheet"
            onSubmit={save}
          >
            <div className="modal-head">
              <div>
                <h2>{edit ? "แก้ไขที่พัก" : "เพิ่มที่พัก"}</h2>
                <p>เลือกช่วงวันที่เข้าพัก ระบบจะแสดงคืนที่ 1/N ใน Timeline</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(null)}
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flight-sheet-scroll">
              <div className="form-grid">
                <div className="field">
                  <label>ชื่อที่พัก</label>
                  <input
                    name="name"
                    required
                    maxLength={180}
                    defaultValue={edit?.name || ""}
                    placeholder="เช่น APA Hotel Hakata"
                  />
                </div>
                <div className="form-row accommodation-booking-row">
                  <LocationSearch
                    options={locations}
                    defaultValue={edit?.location || ""}
                  />
                  <BookingPlatformPicker
                    value={bookingPlatform}
                    onChange={setBookingPlatform}
                  />
                </div>
                <label className="trip-flight-checkbox accommodation-breakfast-toggle">
                  <input
                    key={`breakfast-${edit?.id || "new"}`}
                    name="includesBreakfast"
                    type="checkbox"
                    value="true"
                    defaultChecked={Boolean(edit?.includes_breakfast)}
                  />
                  <span className="split-checkmark" aria-hidden="true" />
                  <Coffee size={19} aria-hidden="true" />
                  <span>
                    <strong>มีอาหารเช้า</strong>
                    <small>ที่พักรวมอาหารเช้าไว้ในการจอง</small>
                  </span>
                </label>
                <div className="form-row">
                  <div className="field">
                    <label>เช็กอิน</label>
                    <select
                      value={checkInDay}
                      onChange={(event) => {
                        const day = Number(event.target.value);
                        setCheckInDay(day);
                        if (checkOutDay <= day)
                          setCheckOutDay(Math.min(totalDays + 1, day + 1));
                        void loadRate(currency, day);
                      }}
                    >
                      {Array.from(
                        { length: totalDays },
                        (_, index) => index + 1,
                      ).map((day) => (
                        <option value={day} key={day}>
                          Day {displayDay(day)} · {tripDateLabel(startDate, day)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>เช็กเอาต์</label>
                    <select
                      value={checkOutDay}
                      onChange={(event) =>
                        setCheckOutDay(Number(event.target.value))
                      }
                    >
                      {Array.from(
                        { length: totalDays + 1 - checkInDay },
                        (_, index) => checkInDay + index + 1,
                      ).map((day) => (
                        <option value={day} key={day}>
                          {day === totalDays + 1
                            ? `หลังจบทริป · ${tripDateLabel(startDate, day)}`
                            : `Day ${displayDay(day)} · ${tripDateLabel(startDate, day)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <section className="accommodation-night-details">
                  <div>
                    <strong>
                      {focusedDetailDay === null
                        ? "รายละเอียดแต่ละวัน"
                        : `รายละเอียด Day ${displayDay(focusedDetailDay)}`}
                    </strong>
                    <small>
                      {focusedDetailDay === null
                        ? "แยกบันทึกใน Timeline ของแต่ละคืน"
                        : `คืนที่ ${focusedDetailDay - checkInDay + 1}/${checkOutDay - checkInDay} · ${tripDateLabel(startDate, focusedDetailDay)}`}
                    </small>
                  </div>
                  {detailDays.map((day) => (
                    <div className="field" key={day}>
                      <label>
                        Day {displayDay(day)} · คืนที่ {day - checkInDay + 1}/
                        {checkOutDay - checkInDay}
                      </label>
                      <textarea
                        maxLength={2000}
                        value={nightDescriptions[String(day)] || ""}
                        onChange={(event) =>
                          setNightDescriptions((current) => ({
                            ...current,
                            [String(day)]: event.target.value,
                          }))
                        }
                        placeholder={`รายละเอียดสำหรับ Day ${displayDay(day)} เช่น วิธีเช็กอินหรือหมายเหตุ`}
                      />
                    </div>
                  ))}
                </section>
                <div className="form-row flight-datetime-row">
                  <div className="field">
                    <label>เวลาเช็กอิน</label>
                    <NativeTimeInput
                      key={`in-${edit?.id || "new"}`}
                      name="checkInTime"
                      value={edit?.check_in_time?.slice(0, 5) || "15:00"}
                      label="เวลาเช็กอิน"
                    />
                  </div>
                  <div className="field">
                    <label>เวลาเช็กเอาต์</label>
                    <NativeTimeInput
                      key={`out-${edit?.id || "new"}`}
                      name="checkOutTime"
                      value={edit?.check_out_time?.slice(0, 5) || "11:00"}
                      label="เวลาเช็กเอาต์"
                    />
                  </div>
                </div>
                <section className="accommodation-price-section">
                  <div className="accommodation-price-heading">
                    <ReceiptText size={17} />
                    <div>
                      <strong>ค่าใช้จ่ายที่พัก</strong>
                      <small>คิดยอดรวมครั้งเดียว ไม่คูณตามจำนวนคืน</small>
                    </div>
                  </div>
                  <div className="form-row money-currency-row">
                    <div className="field">
                      <label>ยอดเงิน</label>
                      <MoneyInput
                        key={`money-${edit?.id || "new"}`}
                        defaultValue={edit?.foreign_amount || ""}
                      />
                    </div>
                    <div className="field">
                      <label>สกุลเงิน</label>
                      <select
                        value={currency}
                        onChange={(event) =>
                          void loadRate(event.target.value, checkInDay)
                        }
                      >
                        {currencyOptions.map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {currency !== "THB" && (
                    <p
                      className={`exchange-rate-note ${rateLoading ? "loading" : ""}`}
                    >
                      {rateLoading
                        ? "กำลังโหลดอัตราแลกเปลี่ยน…"
                        : `1 ${currency} = ${exchangeRate} THB · ${rateEstimated ? "เรตล่าสุดสำหรับวันในอนาคต" : "เรตประจำวันที่"} ${rateDate}`}
                    </p>
                  )}
                  <div
                    className="field split-member-field"
                    ref={splitPickerRef}
                  >
                    <label>หารกับ</label>
                    <button
                      type="button"
                      className={`split-member-trigger ${splitPickerOpen ? "is-open" : ""}`}
                      onClick={() => setSplitPickerOpen((value) => !value)}
                      aria-expanded={splitPickerOpen}
                    >
                      <span>
                        {splitMemberIds.length === allMemberIds.length
                          ? "หารทุกคน"
                          : splitMemberIds.length === 1
                            ? members.find(
                                (member) => member.id === splitMemberIds[0],
                              )?.display_name || "1 คน"
                            : `${splitMemberIds.length} คน`}
                      </span>
                      <ChevronDown size={16} />
                    </button>
                    {splitPickerOpen && (
                      <div className="split-member-menu">
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              allMemberIds.length > 0 &&
                              splitMemberIds.length === allMemberIds.length
                            }
                            onChange={(event) =>
                              setSplitMemberIds(
                                event.target.checked ? allMemberIds : [],
                              )
                            }
                          />
                          <span className="split-checkmark" />
                          <span>หารทุกคน</span>
                        </label>
                        {members.map((member) => {
                          const label =
                            member.display_name || member.email || "-";
                          return (
                            <label key={member.id}>
                              <input
                                type="checkbox"
                                checked={splitMemberIds.includes(member.id)}
                                onChange={(event) =>
                                  setSplitMemberIds((current) =>
                                    event.target.checked
                                      ? [...new Set([...current, member.id])]
                                      : current.filter(
                                          (id) => id !== member.id,
                                        ),
                                  )
                                }
                              />
                              <span className="split-checkmark" />
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
                                {!member.avatar_url &&
                                  label.charAt(0).toUpperCase()}
                              </span>
                              <span>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <fieldset className="expense-payment-picker accommodation-payment-picker">
                    <legend>ช่องทางชำระ</legend>
                    <label>
                      <input
                        type="radio"
                        name="paymentSource"
                        value="cash"
                        checked={paymentSource === "cash"}
                        onChange={(event) =>
                          setPaymentSource(event.target.value)
                        }
                      />
                      <span className="expense-payment-option">
                        <span className="cash-payment-icon payment-cash-icon" />
                        <span>
                          <b>เงินสด</b>
                          <small>ใช้ร่วมกันในทริป</small>
                        </span>
                      </span>
                    </label>
                    {cards.map((card) => (
                      <label key={card.id}>
                        <input
                          type="radio"
                          name="paymentSource"
                          value={card.id}
                          checked={paymentSource === card.id}
                          onChange={(event) =>
                            setPaymentSource(event.target.value)
                          }
                        />
                        <span className="expense-payment-option">
                          <CardLogo brand={card.brand} />
                          <span>
                            <b>{card.nickname}</b>
                            <small>
                              {card.owner_name || card.owner_email} · x-
                              {card.last_four}
                            </small>
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </section>
              </div>
            </div>
            <div className="modal-submit-actions flight-sheet-actions">
              <button className="primary-btn" disabled={saving || rateLoading}>
                {saving ? "กำลังบันทึก…" : "บันทึกที่พัก"}
              </button>
              {edit && canDelete && (
                <button
                  type="button"
                  className="delete-record-btn"
                  onClick={() => setDeleteTarget(edit)}
                  disabled={saving}
                  aria-label="ลบที่พัก"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div
          className="confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setDeleteTarget(null);
          }}
        >
          <div className="confirm-dialog" role="alertdialog" aria-modal="true">
            <span className="confirm-icon">
              <Trash2 size={21} />
            </span>
            <h2>ลบ “{deleteTarget.name}”?</h2>
            <p>
              ที่พักทุกคืนใน Timeline และค่าใช้จ่ายที่เชื่อมไว้จะถูกลบพร้อมกัน
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="confirm-delete"
                onClick={() => void remove()}
                disabled={saving}
              >
                {saving ? "กำลังลบ…" : "ลบที่พัก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
