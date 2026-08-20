"use client";

import {
  createContext,
  Fragment,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type {
  CountryHighlight,
  TravelAnalyticsCollection,
  TravelAnalyticsPayload,
  TravelAnalyticsScope,
} from "@/src/lib/trip-loaders";
import {
  clearOfflineDocuments,
  clearPrivateOfflineData,
} from "@/src/components/pwa-runtime";
import { useFormDirty } from "@/src/components/use-form-dirty";
import {
  clearCurrentAccount,
  getCurrentAccount,
  updateCurrentAccount,
} from "@/src/lib/client-account";
import { optimizedCanvasFile } from "@/src/lib/client-image-compression";
import {
  accommodationResourceKey,
  flightResourceKey,
  invalidateClientResource,
  invalidateClientResourcesContaining,
} from "@/src/lib/client-resource-cache";
import {
  TRIP_COUNTRIES,
  countryByCode,
  formatTripDestination,
  inferTripCountry,
  tripCity,
} from "@/src/lib/countries";
import { FlightPassengerInfoList } from "@/src/components/flight-passenger-info";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BedDouble,
  BusFront,
  CalendarDays,
  CarFront,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Cloud,
  Copy,
  Crown,
  Database,
  FolderOpen,
  Footprints,
  Gem,
  Globe2,
  ImagePlus,
  Images,
  GripVertical,
  House,
  Languages,
  LocateFixed,
  LogOut,
  MapPin,
  Minus,
  Moon,
  Navigation,
  Pencil,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  Ship,
  Sparkles,
  Star,
  Sun,
  TrainFront,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

const TripWorkspace = dynamic(
  () =>
    import("@/src/components/trip-workspace").then(
      (module) => module.TripWorkspace,
    ),
  { loading: () => <div className="card">กำลังเปิดพื้นที่ทริป…</div> },
);
const TripFlights = dynamic(
  () => import("@/src/components/trip-flights").then((module) => module.TripFlights),
  { loading: () => <div className="card">กำลังเปิดข้อมูลเที่ยวบิน…</div> },
);
const TripAccommodations = dynamic(
  () => import("@/src/components/trip-accommodations").then((module) => module.TripAccommodations),
  { loading: () => <div className="card">กำลังเปิดข้อมูลที่พัก…</div> },
);

type Screen =
  | "dashboard"
  | "analytics"
  | "trips"
  | "trip"
  | "timeline"
  | "expenses"
  | "settings";
type WorkspaceTab = "checklist" | "documents" | "history";
type Lang = "TH" | "EN";
type TripStatus = "all" | "ongoing" | "upcoming" | "past";
type TripType = "all" | "domestic" | "international";
type TripFilters = {
  status: string;
  type: string;
  year: string;
  q: string;
  sort: string;
};
export type DashboardCounts = {
  total: number;
  ongoing: number;
  upcoming: number;
  past: number;
};
type AccountProfile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};
type TripInvitation = {
  id: string;
  trip_id: string;
  email: string;
  created_at: string;
  trip_name: string;
  destination: string;
  cover_image_url: string | null;
  outbound_departure_at: string | null;
  return_departure_at: string | null;
  total_days: number;
  owner_name: string;
  owner_email: string;
  owner_avatar_url: string | null;
};
type TripMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "owner" | "collaborator";
  access_level?: "owner" | "view" | "admin";
};
export type Trip = {
  id: string;
  name: string;
  destination: string;
  country_code?: string | null;
  country_name?: string | null;
  start_date: string;
  total_days: number;
  budget_thb: string;
  shopping_budget_thb: string;
  actual_spent_thb?: number | string;
  outbound_departure_at: string | null;
  return_departure_at: string | null;
  cover_image_url: string | null;
  google_photos_url: string | null;
  timezone?: string;
  has_flights?: boolean;
  has_day_zero?: boolean;
  access_role?: "owner" | "view" | "admin";
  members?: TripMember[];
  review_average?: number;
  review_count?: number;
  has_incomplete_setup?: boolean;
};
type TripReview = {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: "owner" | "collaborator";
  rating: string | null;
  review: string | null;
  updated_at: string | null;
  is_current_user: boolean;
};
type Collaborator = {
  id: string;
  email: string;
  user_id: string | null;
  joined: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
  access_level: "view" | "admin";
};
type CardBrand = "visa" | "mastercard" | "jcb";
export type PaymentCard = {
  id: string;
  nickname: string;
  brand: CardBrand | null;
  last_four: string;
  is_active: boolean;
  sort_order?: number;
  owner_id?: string;
  owner_name?: string;
  owner_email?: string | null;
  owner_avatar_url?: string | null;
  is_own?: boolean;
  member_role?: "owner" | "collaborator";
};
type CostItem = {
  id?: string;
  key: string;
  value: number;
  category?: string;
  currency?: string;
  foreignAmount?: number;
  exchangeRate?: number;
  rateDate?: string;
  paymentMethod?: string;
  creditCardId?: string;
  paymentOwnerName?: string;
  splitMemberIds?: string[];
};
type NearbyFlight = {
  id: string;
  trip_id: string;
  journey_type: "outbound" | "return" | "internal";
  airline_code: string;
  airline_name: string;
  flight_number: string;
  departure_airport_code: string;
  departure_airport_name: string | null;
  arrival_airport_code: string;
  arrival_airport_name: string | null;
  scheduled_departure_at: string;
  scheduled_arrival_at: string;
  entered_departure_local_text: string | null;
  entered_arrival_local_text: string | null;
  latest_departure_at: string | null;
  latest_arrival_at: string | null;
  departure_terminal: string | null;
  departure_gate: string | null;
  arrival_terminal: string | null;
  arrival_gate: string | null;
  status: string;
  last_synced_at: string | null;
  booking_reference: string | null;
  cabin_class: string | null;
  baggage_note: string | null;
  ticket_price: string | null;
  ticket_currency: string | null;
  passengers: Array<{
    user_id: string;
    seat_number: string | null;
    meal_preference: string | null;
    carry_on_baggage: string | null;
    checked_baggage: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  trip_name: string;
};
export type Itinerary = {
  id: string;
  day_number: number;
  time_slot: "morning" | "afternoon" | "evening";
  start_time: string | null;
  place_name: string;
  address: string | null;
  image_url: string | null;
  transport_mode: string | null;
  transport_note: string | null;
  cost_items: CostItem[];
  accommodation_id?: string | null;
  accommodation_night?: number | null;
  accommodation_nights?: number | null;
};
type Modal =
  | { type: "trip"; trip?: Trip }
  | { type: "place"; item?: Itinerary; duplicateOf?: Itinerary }
  | { type: "cost"; item?: Itinerary; costIndex?: number; defaultDay?: number }
  | { type: "collaborators"; trip: Trip }
  | { type: "reviews"; trip: Trip }
  | null;
type Confirmation = {
  title: string;
  description: string;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => void | Promise<void>;
};
type StorageMetric = {
  id: "vercel" | "neon" | "blob";
  label: string;
  usedBytes: number | null;
  limitBytes: number | null;
  percent: number | null;
  status: "ok" | "estimated" | "unavailable";
  detail: string;
  itemCount?: number;
};
type StorageUsage = { metrics: StorageMetric[]; updatedAt: string };
const DEFAULT_TRIP_COVER = "/travel-postcard-fallback.jpg";
const EMPTY_ITINERARIES: Itinerary[] = [];
const coverPlaceholderCache = new Map<string, string>();
function authenticatedCoverLoader({ src, width, quality }: ImageLoaderProps) {
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}w=${width}&q=${quality || 76}`;
}
function TripCoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const privateUpload = src.startsWith("/api/uploads/");
  const cachedPlaceholder = coverPlaceholderCache.get(src);
  const rememberPlaceholder = (image: HTMLImageElement) => {
    if (coverPlaceholderCache.has(src) || !image.naturalWidth) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 18;
      canvas
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);
      const placeholder = canvas.toDataURL("image/jpeg", 0.58);
      if (coverPlaceholderCache.size >= 64) {
        const oldest = coverPlaceholderCache.keys().next().value;
        if (oldest) coverPlaceholderCache.delete(oldest);
      }
      coverPlaceholderCache.set(src, placeholder);
    } catch {
      // A cover can still render normally if a browser blocks canvas access.
    }
  };
  return (
    <Image
      loader={privateUpload ? authenticatedCoverLoader : undefined}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      quality={76}
      priority={priority}
      loading={!priority && cachedPlaceholder ? "eager" : undefined}
      decoding={cachedPlaceholder ? "sync" : "async"}
      className={className}
      draggable={false}
      style={
        cachedPlaceholder
          ? {
              backgroundImage: `url("${cachedPlaceholder}")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
      onLoad={(event) => rememberPlaceholder(event.currentTarget)}
    />
  );
}
const CURRENCY_OPTIONS = [
  { value: "THB", label: "บาท (THB)" },
  { value: "CNY", label: "หยวน (CNY)" },
  { value: "JPY", label: "เยน (JPY)" },
  { value: "USD", label: "ดอลลาร์สหรัฐ (USD)" },
  { value: "EUR", label: "ยูโร (EUR)" },
  { value: "GBP", label: "ปอนด์อังกฤษ (GBP)" },
  { value: "KRW", label: "วอนเกาหลี (KRW)" },
  { value: "SGD", label: "ดอลลาร์สิงคโปร์ (SGD)" },
  { value: "HKD", label: "ดอลลาร์ฮ่องกง (HKD)" },
  { value: "TWD", label: "ดอลลาร์ไต้หวัน (TWD)" },
  { value: "MYR", label: "ริงกิตมาเลเซีย (MYR)" },
  { value: "VND", label: "ดองเวียดนาม (VND)" },
  { value: "IDR", label: "รูเปียห์อินโดนีเซีย (IDR)" },
  { value: "PHP", label: "เปโซฟิลิปปินส์ (PHP)" },
  { value: "AUD", label: "ดอลลาร์ออสเตรเลีย (AUD)" },
  { value: "NZD", label: "ดอลลาร์นิวซีแลนด์ (NZD)" },
  { value: "CAD", label: "ดอลลาร์แคนาดา (CAD)" },
  { value: "CHF", label: "ฟรังก์สวิส (CHF)" },
  { value: "AED", label: "เดอร์แฮมสหรัฐอาหรับเอมิเรตส์ (AED)" },
  { value: "INR", label: "รูปีอินเดีย (INR)" },
] as const;
let activeLang: Lang = "TH";
const EN_TEXT: Record<string, string> = {
  เก็บทุกเส้นทาง: "Keep every journey",
  ไว้ในที่เดียว: "in one place",
  "แพลนที่เที่ยว จดโมเมนต์ และคุมงบ":
    "Plan places, save moments, and track spending",
  "ในสมุดเดินทางของ B & N": "in the B & N travel journal",
  เปิดสมุดเดินทาง: "Open travel journal",
  พื้นที่ส่วนตัว: "Private space",
  ยังไม่กำหนดวัน: "Dates not set",
  กำลังเดินทาง: "Ongoing",
  ที่ผ่านมาแล้ว: "Completed",
  รีวิวทริป: "Trip reviews",
  รีวิว: "reviews",
  คะแนนเฉลี่ย: "Average rating",
  รีวิวของแต่ละคน: "Reviews from each traveler",
  "ให้คะแนน 1.0–5.0 และบันทึกความรู้สึกหลังจบทริป":
    "Rate 1.0–5.0 and save your thoughts after the trip",
  รีวิวของคุณ: "Your review",
  เขียนรีวิวของคุณ: "Write your review",
  "เล่าความประทับใจ สิ่งที่ชอบ หรือสิ่งที่อยากปรับในทริปหน้า":
    "Share highlights, favorites, or what you would change next time",
  บันทึกรีวิว: "Save review",
  บันทึกรีวิวแล้ว: "Review saved",
  ยังไม่ได้รีวิว: "Not reviewed yet",
  เลือกคะแนน: "Choose rating",
  กำลังโหลดรีวิว: "Loading reviews",
  "โหลดรีวิวไม่สำเร็จ": "Could not load reviews",
  "บันทึกรีวิวไม่สำเร็จ": "Could not save review",
  ข้อมูลเที่ยวบินยังไม่ครบ: "Flight information is incomplete",
  "ข้อมูลเที่ยวบินหรือประกันเดินทางยังไม่ครบ":
    "Flight or travel insurance information is incomplete",
  แก้ไข: "Edit",
  ลบ: "Delete",
  เรื่องราวระหว่างทาง: "Stories along the way",
  ดึงลงเพื่อรีเฟรช: "Pull to refresh",
  ปล่อยเพื่อรีเฟรช: "Release to refresh",
  "กำลังอัปเดต…": "Refreshing…",
  อัปเดตหน้าแรกแล้ว: "Home updated",
  "รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง":
    "Refresh failed. Please try again",
  "แพลนทริป หรือกลับมาเปิดดูความทรงจำเดิมได้ทุกเมื่อ":
    "Plan a new trip or revisit routes and memories anytime",
  สร้างทริปใหม่: "Create trip",
  ทริปที่กำลังจะมาถึง: "Upcoming trips",
  หน้ากระดาษนี้ยังว่าง: "Nothing here yet",
  "สร้างทริปใหม่ แล้วเริ่มเติมสถานที่ที่อยากไปกัน":
    "Create a trip and start adding places you want to visit",
  ทริปที่ผ่านมาแล้ว: "Past trips",
  ย้อนกลับไปดูเส้นทางและความทรงจำเดิมได้เสมอ:
    "Revisit your routes and memories anytime",
  "เมื่อจบทริปแล้ว เราจะเก็บการเดินทางไว้ตรงนี้ให้อัตโนมัติ":
    "Completed trips will automatically appear here",
  ย้อนกลับ: "Back",
  ไป: "Depart",
  กลับ: "Return",
  ยังไม่ได้กรอกราคา: "No expenses yet",
  กรอกเงิน: "Add expense",
  เช้า: "Morning",
  บ่าย: "Afternoon",
  เย็น: "Evening",
  ค่าใช้จ่าย: "Expenses",
  แพลน: "Plan",
  วันนี้: "Today",
  เพิ่มสถานที่: "Add place",
  เพิ่มแผน: "Add plan",
  "เพิ่มสถานที่และเวลา รายการใหม่จะถูกเรียงใน Timeline อัตโนมัติ":
    "Add a place and time. New items are sorted automatically",
  ไม่ระบุเวลา: "No time",
  ยังไม่ได้ระบุสถานที่: "Location not specified",
  ยังไม่ได้ระบุที่อยู่: "Address not specified",
  นำทางจากจุดก่อนหน้า: "Directions from previous stop",
  นำทางจากที่อยู่ปัจจุบัน: "Directions from current location",
  เส้นทางไปจุดถัดไป: "Route to next stop",
  จุดหมายสุดท้ายของวันนี้: "Final destination today",
  เพิ่มวิธีเดินทาง: "Add transport",
  "เพิ่มสถานที่ เวลา และวิธีเดินทางสำหรับวันนี้":
    "Add places, times, and transportation for today",
  งบทั้งทริป: "Trip budget",
  ใช้ไป: "Spent",
  เกินงบ: "Over budget",
  คงเหลือ: "Remaining",
  "อื่น ๆ": "Other",
  สัดส่วนค่าใช้จ่ายตามประเภท: "Expense share by category",
  ค่าใช้จ่ายทริป: "Total expense",
  "ค่า Shopping": "Shopping",
  งบหลัก: "Main budget",
  "งบ Shopping": "Shopping budget",
  แยกตามช่องทางชำระ: "By payment method",
  เจ้าของ: "Owner",
  ยังไม่มีข้อมูลช่องทางชำระ: "No payment data yet",
  รวมค่าใช้จ่าย: "Total expenses",
  ยังไม่มีค่าใช้จ่าย: "No expenses yet",
  สรุปค่าใช้จ่ายจากแพลน: "Plan expense summary",
  ยอดรวมแปลงเป็นเงินบาทด้วยเรตของวันที่บันทึก:
    "Totals are converted to THB using the saved date's rate",
  เพิ่มค่าใช้จ่าย: "Add expense",
  กลับด้านบน: "Back to top",
  "ต้องเพิ่ม Timeline ก่อน": "Add a Timeline item first",
  "วันนี้ยังไม่มี Timeline": "No Timeline items today",
  ยังไม่มีราคาที่กรอกในวันนี้: "No expenses recorded today",
  "ยังไม่มี Timeline ในวันนี้": "No Timeline items today",
  ตั้งค่า: "Settings",
  ค่าของบัญชีและอุปกรณ์นี้: "Account and device preferences",
  ธีมการแสดงผล: "Appearance",
  "สลับ Light / Dark mode": "Switch Light / Dark mode",
  เปลี่ยนธีม: "Change theme",
  "ภาษา · Language": "Language",
  ภาษาอินเทอร์เฟซหลัก: "Primary interface language",
  บัตรและการชำระเงิน: "Cards and payments",
  ยังไม่มีบัตรที่บันทึกไว้: "No saved cards",
  เพิ่มบัตร: "Add card",
  แก้ไขบัตร: "Edit card",
  ชื่อบัตร: "Card name",
  "เช่น KBank Platinum": "e.g. KBank Platinum",
  ประเภทบัตร: "Card network",
  "เลข 4 หลักสุดท้าย": "Last 4 digits",
  "เลข 4 หลักสุดท้ายไม่สามารถแก้ไขได้": "The last 4 digits cannot be changed.",
  บันทึกบัตร: "Save card",
  "กำลังบันทึกบัตร…": "Saving card…",
  เพิ่มบัตรแล้ว: "Card added",
  แก้ไขบัตรแล้ว: "Card updated",
  ลบบัตรแล้ว: "Card deleted",
  ข้อมูลบัตรไม่ถูกต้อง: "Invalid card details",
  "บันทึกเฉพาะชื่อเรียกและเลข 4 หลักท้าย ไม่เก็บเลขบัตรเต็ม":
    "Only the card name and last 4 digits are saved. Full card numbers are never stored.",
  ลบบัตรนี้: "Delete this card",
  บัตรจะถูกนำออกจากตัวเลือกช่องทางชำระ:
    "This card will be removed from payment options",
  จัดลำดับบัตร: "Reorder cards",
  เสร็จแล้ว: "Done",
  ดูทั้งหมด: "View all",
  ซ่อน: "Hide",
  เลื่อนบัตรขึ้น: "Move card up",
  เลื่อนบัตรลง: "Move card down",
  ลากเพื่อจัดลำดับบัตร: "Drag to reorder card",
  พื้นที่ระบบ: "System storage",
  เฉพาะผู้ดูแลระบบ: "Admin only",
  เปิดข้อมูลพื้นที่ระบบ: "Show system storage",
  ซ่อนข้อมูลพื้นที่ระบบ: "Hide system storage",
  "กำลังตรวจสอบพื้นที่…": "Checking storage…",
  ตรวจสอบพื้นที่อีกครั้ง: "Refresh storage usage",
  จาก: "of",
  ไฟล์: "files",
  ข้อมูลโดยประมาณ: "Estimated",
  ไม่พร้อมใช้งาน: "Unavailable",
  อัปเดตล่าสุด: "Last updated",
  ออกจากระบบ: "Sign out",
  ออกจากบัญชีบนอุปกรณ์นี้: "Sign out of the account on this device",
  ยกเลิก: "Cancel",
  "กำลังลบ…": "Deleting…",
  ยืนยันการลบ: "Confirm deletion",
  "ลบ Checklist แล้ว": "Checklist deleted",
  "ลบหมวด Checklist แล้ว": "Checklist category deleted",
  เลือกทั้งหมด: "Select all",
  เปลี่ยนรูปหน้าปก: "Change cover image",
  เพิ่มรูปหน้าปก: "Add cover image",
  "ระบบจะ Crop เป็นภาพแนวนอน 16:9 · JPG, PNG หรือ WebP":
    "The image will be cropped to 16:9 · JPG, PNG, or WebP",
  จัดตำแหน่งรูปหน้าปก: "Position cover image",
  "ภาพที่ได้เป็นสัดส่วน 16:9": "Output ratio is 16:9",
  ซูม: "Zoom",
  "ซ้าย–ขวา": "Left–right",
  "บน–ล่าง": "Up–down",
  ใช้ภาพนี้เป็นหน้าปก: "Use as cover image",
  ครอบรูปหน้าปก: "Crop cover image",
  "ลากด้วยหนึ่งนิ้ว · จีบเข้า–ออกด้วยสองนิ้ว":
    "Drag with one finger · Pinch with two fingers",
  "ลากเพื่อขยับ · จีบเพื่อซูม": "Drag to move · Pinch to zoom",
  ยืนยันและกลับไปบันทึก: "Confirm and return",
  เลือกรูปแล้ว: "Image selected",
  แตะเพื่อเลือกและครอบรูปใหม่: "Tap to choose and crop another image",
  "เลือกภาพ แล้วจัดตำแหน่งในกรอบแนวนอน 16:9":
    "Choose an image, then position it in the 16:9 frame",
  "ลิงก์โฟลเดอร์ Google Photos": "Google Photos folder link",
  "เปิด Google Photos": "Open Google Photos",
  แก้ไขค่าใช้จ่าย: "Edit expense",
  "แก้ไขหรือย้ายรายการไปยัง Timeline อื่นได้":
    "Edit or move this expense to another Timeline item",
  เลือกรายการในแพลนที่ค่าใช้จ่ายนี้เกิดขึ้น:
    "Choose where this expense occurred",
  วันที่: "Date",
  "จุดใน Timeline": "Timeline item",
  "เลือก Timeline": "Choose Timeline",
  รายการ: "Item",
  "เช่น ค่าอาหารเย็น": "e.g. Dinner",
  หมวดหมู่: "Category",
  "หารกับ": "Split with",
  "หารทุกคน": "Everyone",
  "เลือกคนที่หาร": "Choose people",
  "กรุณาเลือกผู้ร่วมทริปอย่างน้อย 1 คน":
    "Choose at least one trip member",
  "สรุปค่าใช้จ่ายแยกตามคน": "Expense split by person",
  "คำนวณจากผู้ที่เลือกหารในแต่ละรายการ":
    "Calculated from the people selected for each expense",
  "รวมที่ต้องรับผิดชอบ": "Total share",
  อาหาร: "Food",
  เดินทาง: "Transport",
  ที่พัก: "Accommodation",
  เที่ยวบิน: "Flights",
  เที่ยวบินและที่พัก: "Flights & stays",
  กิจกรรม: "Activities",
  ของฝาก: "Souvenirs",
  ยอดเงิน: "Amount",
  สกุลเงิน: "Currency",
  "บาท (THB)": "Baht (THB)",
  "หยวน (CNY)": "Yuan (CNY)",
  "เยน (JPY)": "Yen (JPY)",
  "ดอลลาร์ (USD)": "Dollar (USD)",
  "อัตราแลกเปลี่ยนเป็น THB": "Exchange rate to THB",
  "กำลังโหลด…": "Loading…",
  ใช้เรทปัจจุบัน: "Use current rate",
  "กำลังโหลดอัตราแลกเปลี่ยน…": "Loading exchange rate…",
  ช่องทางชำระ: "Payment method",
  เงินสด: "Cash",
  โอนเงิน: "Bank transfer",
  บัตรเครดิต: "Credit card",
  บัตรเดบิต: "Debit card",
  "กำลังบันทึก…": "Saving…",
  บันทึกค่าใช้จ่าย: "Save expense",
  ลบค่าใช้จ่ายนี้: "Delete this expense",
  "ค่าใช้จ่ายนี้จะถูกลบออกจาก Timeline และหน้าสรุป":
    "This expense will be removed from the Timeline and summary",
  แก้ไขทริป: "Edit trip",
  เพิ่มแผนเที่ยว: "Add plan item",
  แก้ไขรายการ: "Edit item",
  ชื่อทริป: "Trip name",
  เมืองหรือประเทศปลายทาง: "City or country",
  วันเดินทางไป: "Departure date",
  เวลาเดินทางไป: "Departure time",
  วันเดินทางกลับ: "Return date",
  เวลาเดินทางกลับ: "Return time",
  "งบหลัก (THB)": "Main budget (THB)",
  "งบ Shopping (THB)": "Shopping budget (THB)",
  วัน: "Day",
  เวลา: "Time",
  เวลาเริ่มรายการ: "Item start time",
  "เปลี่ยนแผนได้ทุกเมื่อ ระบบจะย้ายรายการไปยังวันที่เลือกและเรียงตามเวลาให้อัตโนมัติ":
    "Change plans anytime. Items move to the selected day and sort automatically",
  ชื่อรายการ: "Item name",
  "สถานที่ / ที่อยู่": "Place / address",
  วิธีเดินทางมาที่นี่: "Transport to here",
  เดิน: "Walk",
  รถไฟ: "Train",
  รถยนต์: "Car",
  รถบัส: "Bus",
  แท็กซี่: "Taxi",
  เครื่องบิน: "Plane",
  เรือ: "Boat",
  รายละเอียด: "Details",
  "รายละเอียดร้าน การเดินทาง หรือสิ่งที่ต้องจำ":
    "Venue details, directions, or reminders",
  บันทึก: "Save",
  ลบรายการนี้: "Delete this item",
  "รายการนี้ รวมถึงรายละเอียดและราคาที่บันทึกไว้จะถูกลบออกจาก Timeline":
    "This item, its details, and recorded expenses will be removed from the Timeline",
  สถานที่ที่เคยใช้ในทริปนี้: "Places previously used in this trip",
  เลือกสถานที่: "Choose place",
  "กำลังโหลดข้อมูล…": "Loading…",
  ไม่พบทริปนี้: "Trip not found",
  ทริปอาจถูกลบหรือไม่ได้อยู่ในบัญชีนี้:
    "This trip may have been deleted or is not in this account",
  กลับไปเลือกทริป: "Back to trips",
  เมนูหลัก: "Main menu",
  หน้าแรก: "Home",
  แผนวันที่: "Day",
  "· กลับ": "· Return",
  รายการค่าใช้จ่าย: "expenses",
  "สถานที่ · เรียงตามเวลาอัตโนมัติ": "places · sorted automatically",
  สถานที่: "places",
  เวลาปัจจุบัน: "Current time",
  เรตล่าสุดสำหรับวันในอนาคต: "latest future-date rate",
  เรตประจำวันที่: "rate for",
  "กำลังบันทึกและอัปโหลด…": "Saving and uploading…",
  เรียงตามเวลาอัตโนมัติ: "sorted automatically",
  "- / ไม่ระบุ": "- / Not specified",
  "Day นี้ยังว่างอยู่": "This day is empty",
  นำทางจาก: "Directions from",
  ไปยัง: "to",
  โหลดข้อมูลทริปไม่สำเร็จ: "Could not load trips",
  เข้าสู่ระบบไม่สำเร็จ: "Sign in failed",
  บันทึกไม่สำเร็จ: "Could not save",
  อัปโหลดรูปไม่สำเร็จ: "Image upload failed",
  "รองรับเฉพาะ JPG, PNG และ WebP": "Only JPG, PNG, and WebP are supported",
  "รูปต้องมีขนาดไม่เกิน 8 MB": "Image must be no larger than 8 MB",
  ไม่สามารถอ่านไฟล์รูปนี้ได้: "Could not read this image",
  "ไม่สามารถ Crop รูปได้": "Could not crop this image",
  โหลดอัตราแลกเปลี่ยนไม่สำเร็จ: "Could not load exchange rate",
  "กรุณาเลือกจุดใน Timeline": "Choose a Timeline item",
  กรุณากรอกยอดเงินให้ถูกต้อง: "Enter a valid amount",
  กรุณากรอกอัตราแลกเปลี่ยนให้ถูกต้อง: "Enter a valid exchange rate",
  บันทึกค่าใช้จ่ายไม่สำเร็จ: "Could not save expense",
  แก้ไขทริปแล้ว: "Trip updated",
  "สร้างทริปแล้ว เลือกสิ่งที่ต้องการจัดการได้เลย":
    "Trip created. Choose what you want to manage",
  "อัปเดตวัน เวลา และรายละเอียดแล้ว": "Day, time, and details updated",
  "เพิ่มแผนเที่ยวและเรียง Timeline แล้ว": "Plan item added and Timeline sorted",
  "ลบรายการออกจาก Timeline แล้ว": "Item removed from Timeline",
  แก้ไขค่าใช้จ่ายแล้ว: "Expense updated",
  "เพิ่มค่าใช้จ่ายใน Timeline แล้ว": "Expense added to Timeline",
  ลบค่าใช้จ่ายแล้ว: "Expense deleted",
  ลบทริปสำเร็จแล้ว: "Trip deleted",
  "แผนเที่ยว ค่าใช้จ่าย และข้อมูลทั้งหมดในทริปนี้จะถูกลบถาวร":
    "Plans, expenses, and all trip data will be permanently deleted",
  ลบทริป: "Delete trip",
  ลบรายการ: "Delete item",
  ค่าตั๋วเครื่องบิน: "Airfare",
};
Object.assign(EN_TEXT, {
  ทริปทั้งหมด: "All trips",
  งบ: "Budget",
  ใช้จริง: "Spent",
  ดูทั้งหมด: "View all",
  ดูทริปทั้งหมด: "View all trips",
  ทริปที่กำลังเดินทาง: "Ongoing trips",
  "ค้นหาทริป เมือง หรือประเทศ": "Search trips, cities, or countries",
  ทั้งหมด: "All",
  ประเภททริป: "Trip type",
  ในประเทศ: "Domestic",
  กำลังจะมาถึง: "Upcoming",
  ที่ผ่านมา: "Past",
  ทุกปี: "All years",
  เรียงล่าสุด: "Latest",
  ใกล้ถึงวันเดินทาง: "Upcoming first",
  ใกล้ที่สุด: "Nearest",
  เก่าสุด: "Oldest",
  เรียงตามชื่อ: "Name",
  โหลดเพิ่มเติม: "Load more",
  "กำลังโหลดทริป…": "Loading trips…",
  ไม่พบทริปที่ตรงกับตัวกรอง: "No trips match these filters",
  ลองเปลี่ยนคำค้นหาหรือตัวกรอง: "Try changing the search or filters",
  สร้างทริป: "Create trip",
  "เข้าสู่ระบบด้วย Google Account ของคุณ": "Sign in with your Google Account",
  "ทุกบัญชี Google สามารถเริ่มสร้างทริปได้":
    "Any Google Account can start creating trips",
  "เข้าสู่ระบบด้วย Google": "Sign in with Google",
  "ยังไม่ได้ตั้งค่า Google OAuth": "Google OAuth is not configured yet",
  "เข้าสู่ระบบด้วย Google ไม่สำเร็จ": "Google sign-in failed",
  ผู้ร่วมทริป: "Collaborators",
  "เพิ่มด้วย Gmail ผู้ร่วมทริปเพิ่มและแก้ไขได้ แต่ลบไม่ได้":
    "Invite by Gmail. Collaborators can add and edit, but cannot delete.",
  "กำหนด View สำหรับเพิ่มและแก้ไข หรือ Admin สำหรับลบข้อมูลได้ด้วย":
    "Use View for adding and editing, or Admin to allow deleting content too.",
  "เปลี่ยนสิทธิ์เป็น Admin แล้ว": "Permission changed to Admin",
  "เปลี่ยนสิทธิ์เป็น View แล้ว": "Permission changed to View",
  "เปลี่ยนสิทธิ์ไม่สำเร็จ": "Could not change permission",
  อีเมลผู้ร่วมทริป: "Collaborator email",
  "กำลังเพิ่ม…": "Adding…",
  เพิ่มผู้ร่วมทริป: "Add collaborator",
  เข้าร่วมแล้ว: "Joined",
  รอเข้าสู่ระบบ: "Waiting for sign-in",
  รอการตอบรับ: "Awaiting response",
  นำผู้ร่วมทริปออก: "Remove collaborator",
  ยังไม่มีผู้ร่วมทริป: "No collaborators yet",
  โหลดผู้ร่วมทริปไม่สำเร็จ: "Could not load collaborators",
  เพิ่มผู้ร่วมทริปไม่สำเร็จ: "Could not add collaborator",
  เลือกจากคนที่เพิ่มล่าสุด: "Choose a recent collaborator",
  ลบผู้ร่วมทริป: "Remove collaborator",
  ผู้ร่วมทริปคนนี้จะไม่สามารถเข้าถึงหรือแก้ไขทริปนี้ได้อีก:
    "This collaborator will no longer be able to access or edit this trip.",
  ลบผู้ร่วมทริปสำเร็จแล้ว: "Collaborator removed",
  คำเชิญเข้าร่วมทริป: "Trip invitations",
  เชิญคุณเข้าร่วมทริป: "invited you to join",
  ยอมรับ: "Accept",
  "กำลังยอมรับ…": "Accepting…",
  ปฏิเสธ: "Decline",
  "ปฏิเสธคำเชิญนี้?": "Decline this invitation?",
  "คำเชิญนี้จะถูกลบออก และทริปจะไม่ถูกเพิ่มในรายการของคุณ":
    "This invitation will be removed and the trip will not be added to your list.",
  "กำลังปฏิเสธ…": "Declining…",
  ตอบรับคำเชิญแล้ว: "Invitation accepted",
  ปฏิเสธคำเชิญแล้ว: "Invitation declined",
  ออกจากทริป: "Leave trip",
  ออกจากทริปนี้: "Leave this trip",
  "เมื่อออกแล้ว ทริปนี้จะหายจากรายการของคุณและจะไม่สามารถเปิดหรือแก้ไขได้อีก":
    "After leaving, this trip will disappear from your list and you will no longer be able to open or edit it.",
  "กำลังออกจากทริป…": "Leaving trip…",
  ออกจากทริปสำเร็จแล้ว: "You left the trip",
  ใช้ร่วมกันในทริป: "Shared cash for this trip",
  ยินดีต้อนรับกลับมา: "Welcome back",
  สถิติ: "Insights",
  สถิติการเดินทาง: "Travel insights",
  ประเทศที่ประทับใจ: "Favorite countries",
  เรียงตามคะแนนรีวิว: "Sorted by review score",
  ดูทริปทั้งหมดใน: "View all trips in",
  กรองสถิติการเดินทาง: "Filter travel insights",
  ภายในประเทศ: "Domestic",
  ต่างประเทศ: "International",
  "ภาพรวมจากทริปที่ผ่านมาแล้วเท่านั้น":
    "An overview of completed trips only",
  ทริปที่ผ่านมา: "Past trips",
  ประเทศที่เคยไป: "Countries visited",
  ค่าใช้จ่ายเฉลี่ยต่อทริป: "Average spend per trip",
  ค่าใช้จ่ายทั้งหมด: "Total expenses",
  "ไม่รวมค่า Shopping": "Excluding shopping",
  ค่าใช้จ่ายทริปเฉลี่ย: "Average trip expenses",
  "ค่า Shopping เฉลี่ย": "Average shopping spend",
  ทริปในแต่ละปี: "Trips by year",
  "จำนวนทริปและค่าใช้จ่ายรวมในปีนั้น":
    "Trip count and total expenses for each year",
  ประเทศและจำนวนครั้งที่ไป: "Countries and visit count",
  "เรียงจากประเทศที่ไปบ่อยที่สุด": "Sorted by most visited",
  "ยังไม่มีทริปที่ผ่านมาให้สรุป": "No completed trips to summarize yet",
  "เมื่อทริปจบแล้ว สถิติจะปรากฏที่หน้านี้โดยอัตโนมัติ":
    "Completed trips will automatically appear here",
  เมือง: "City",
  ประเทศ: "Country",
  เวลาอัตโนมัติ: "Automatic timezone",
  เรื่องราวการเดินทางของคุณ: "Your travel story",
  "ทุกประเทศ ทุกทริป และทุกความทรงจำในภาพเดียว":
    "Every country, trip, and memory in one view",
  ครั้ง: "visits",
  แก้ไขชื่อที่แสดง: "Edit display name",
  บันทึกชื่อแล้ว: "Name saved",
  "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร": "Enter at least 2 characters",
});
Object.assign(EN_TEXT, {
  ทดลองใช้ก่อน: "Try the demo",
  กำลังทดลองใช้งาน: "Demo mode",
  "ดูข้อมูลได้เต็มที่ · การเพิ่ม แก้ไข และลบ ต้องเข้าสู่ระบบ":
    "Explore everything · Sign in to add, edit, or delete",
  เข้าสู่ระบบ: "Sign in",
  "เข้าสู่ระบบเพื่อเพิ่ม แก้ไข หรือลบข้อมูล":
    "Sign in to add, edit, or delete data",
});
Object.assign(EN_TEXT, {
  "ดอลลาร์สหรัฐ (USD)": "US Dollar (USD)",
  "ยูโร (EUR)": "Euro (EUR)",
  "ปอนด์อังกฤษ (GBP)": "British Pound (GBP)",
  "วอนเกาหลี (KRW)": "Korean Won (KRW)",
  "ดอลลาร์สิงคโปร์ (SGD)": "Singapore Dollar (SGD)",
  "ดอลลาร์ฮ่องกง (HKD)": "Hong Kong Dollar (HKD)",
  "ดอลลาร์ไต้หวัน (TWD)": "New Taiwan Dollar (TWD)",
  "ริงกิตมาเลเซีย (MYR)": "Malaysian Ringgit (MYR)",
  "ดองเวียดนาม (VND)": "Vietnamese Dong (VND)",
  "รูเปียห์อินโดนีเซีย (IDR)": "Indonesian Rupiah (IDR)",
  "เปโซฟิลิปปินส์ (PHP)": "Philippine Peso (PHP)",
  "ดอลลาร์ออสเตรเลีย (AUD)": "Australian Dollar (AUD)",
  "ดอลลาร์นิวซีแลนด์ (NZD)": "New Zealand Dollar (NZD)",
  "ดอลลาร์แคนาดา (CAD)": "Canadian Dollar (CAD)",
  "ฟรังก์สวิส (CHF)": "Swiss Franc (CHF)",
  "เดอร์แฮมสหรัฐอาหรับเอมิเรตส์ (AED)": "UAE Dirham (AED)",
  "รูปีอินเดีย (INR)": "Indian Rupee (INR)",
});
Object.assign(EN_TEXT, {
  ทำสำเนาแผน: "Duplicate plan",
  ทำสำเนาแผนแล้ว: "Plan duplicated",
  "วันและเวลานี้มีแผนอยู่แล้ว กรุณาเลือกเวลาอื่น":
    "A plan already exists at this date and time. Choose another time.",
});
Object.assign(EN_TEXT, {
  เตรียมทริป: "Trip prep",
  Checklist: "Checklist",
  เอกสาร: "Documents",
  ประวัติ: "History",
  เขตเวลาของทริป: "Trip timezone",
  "ใช้คำนวณวันปัจจุบัน เวลา Timeline และสถานะทริป":
    "Used for the current day, Timeline time, and trip status",
  เพิ่มรายการก่อนเดินทาง: "Add a pre-trip task",
  ยังไม่มอบหมาย: "Unassigned",
  เพิ่ม: "Add",
  "ยังไม่มี Checklist": "No checklist items yet",
  "ชื่อเอกสาร เช่น ใบจองโรงแรม": "Document name, e.g. hotel booking",
  อัปโหลด: "Upload",
  "PDF หรือรูปภาพ สูงสุด 15 MB · เลือกเก็บออฟไลน์ภายหลังได้":
    "PDF or image up to 15 MB · optionally save offline later",
  ลบออกจากออฟไลน์: "Remove offline copy",
  เก็บไว้ออฟไลน์: "Save offline",
  ยังไม่มีเอกสาร: "No documents yet",
  สมาชิกทริป: "Trip member",
  ย้อนคืนแล้ว: "Undone",
  ยังไม่มีประวัติการแก้ไข: "No activity yet",
  รีเฟรช: "Refresh",
  Undo: "Undo",
  ดาวน์โหลดเอกสารไม่สำเร็จ: "Could not download document",
  เฉพาะเจ้าของทริปที่ย้อนคืนประวัติได้: "Only the trip owner can undo changes",
  รายการนี้ไม่สามารถย้อนคืนได้: "This change cannot be undone",
});
Object.assign(EN_TEXT, {
  "Master Checklist": "Master Checklist",
  จัดหมวดหมู่และรายการสำหรับใช้ซ้ำในทุกทริป:
    "Organize reusable packing lists for every trip",
  "เลือกจาก Master": "Choose from Master",
  "ค้นหา Checklist": "Search checklist",
  "ไม่พบ Checklist ที่ค้นหา": "No matching checklist",
  "จัดการ Master": "Manage Master",
  "พิมพ์ Checklist เอง (จะบันทึกเข้า Master ด้วย)":
    "Type a checklist item (also saved to Master)",
  เลือกหมวดหมู่: "Choose category",
  "เพิ่ม Checklist": "Add checklist item",
  เพิ่มโดย: "Added by",
  นำเข้ารายการไม่สำเร็จ: "Could not import items",
  พื้นที่เอกสาร: "Document storage",
  "รูปภาพสูงสุด 3 MB · PDF สูงสุด 10 MB · เลือกเก็บออฟไลน์ภายหลังได้":
    "Images up to 3 MB · PDFs up to 10 MB · optionally save offline",
  "รูปจะถูกลดขนาดอัตโนมัติก่อนอัปโหลด · PDF สูงสุด 10 MB · เลือกเก็บออฟไลน์ภายหลังได้":
    "Images are optimized before upload · PDFs up to 10 MB · optionally save offline",
  "พื้นที่ใกล้เต็มมาก กรุณาลบไฟล์ที่ไม่ใช้":
    "Storage is almost full. Remove unused files.",
  "พื้นที่เหลือน้อย กรุณาตรวจสอบไฟล์":
    "Storage is running low. Review your files.",
  "เริ่มใช้พื้นที่เกิน 70% แล้ว": "Storage usage is above 70%",
  "กำลังอัปโหลด…": "Uploading…",
  เพิ่มไฟล์: "Add file",
  "ค้นหาเอกสารหรือชื่อไฟล์": "Search documents or filenames",
  "ไม่พบเอกสารที่ค้นหา": "No matching documents",
  "อัปโหลดไฟล์แล้ว": "File uploaded",
  "ลบไฟล์แล้ว": "File deleted",
  "เก็บเอกสารสำคัญไว้ดูระหว่างทริป":
    "Keep important documents available during the trip",
  "เลือกรูปหรือไฟล์": "Choose image or file",
  "รองรับ JPG, PNG, WebP และ PDF": "Supports JPG, PNG, WebP, and PDF",
  ชื่อไฟล์: "File name",
  "เช่น ใบจองโรงแรม": "e.g. Hotel booking",
  อัปโหลดไฟล์: "Upload file",
  ดูไฟล์: "View file",
  แก้ไขไฟล์: "Edit file",
  "แก้ชื่อหรือเลือกไฟล์ใหม่เพื่อแทนไฟล์เดิม":
    "Rename or choose a new file to replace the current one",
  เลือกไฟล์ใหม่: "Choose new file",
  เลือกไฟล์ใหม่แล้ว: "New file selected",
  ไฟล์ปัจจุบัน: "Current file",
  "ไม่เลือกไฟล์ใหม่ ระบบจะแก้เฉพาะชื่อ · รูปสูงสุด 3 MB · PDF สูงสุด 10 MB":
    "Without a new file, only the name changes · Images up to 3 MB · PDFs up to 10 MB",
  "รูปจะถูกลดขนาดอัตโนมัติก่อนอัปโหลด · PDF สูงสุด 10 MB":
    "Images are optimized before upload · PDFs up to 10 MB",
  "รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB":
    "The source image must be 20 MB or smaller",
  "ไม่สามารถลดรูปให้ต่ำกว่า 3 MB ได้ กรุณาเลือกรูปอื่น":
    "Could not optimize this image below 3 MB. Please choose another image",
  ลบไฟล์นี้: "Delete this file",
  แก้ไขไฟล์แล้ว: "File updated",
  แก้ไขเอกสารไม่สำเร็จ: "Could not update document",
});
Object.assign(EN_TEXT, {
  เอกสารออฟไลน์: "Offline documents",
  "ลบเอกสารที่ดาวน์โหลดไว้จากทุกทริปบนอุปกรณ์นี้":
    "Remove documents downloaded from every trip on this device",
  เคลียร์ทั้งหมด: "Clear all",
  "เคลียร์เอกสารออฟไลน์ทั้งหมด?": "Clear all offline documents?",
  "เอกสารที่ดาวน์โหลดไว้จากทุกทริปจะถูกลบออกจากอุปกรณ์นี้ แต่ไฟล์ต้นฉบับบนระบบจะไม่ถูกลบ":
    "Downloaded documents from every trip will be removed from this device. Original files will remain online.",
  "กำลังเคลียร์…": "Clearing…",
  "เคลียร์เอกสารออฟไลน์ทั้งหมดแล้ว": "All offline documents cleared",
});
Object.assign(EN_TEXT, {
  "ชื่อ Checklist": "Checklist item",
  หมวดหมู่: "Category",
  มอบหมายให้: "Assign to",
  "บันทึก Checklist": "Save checklist",
  "ลบ Checklist นี้": "Delete this checklist item",
  "แก้ไขชื่อ หมวดหมู่ และผู้รับผิดชอบ":
    "Edit the name, category, and assignee",
  "แก้ไข Checklist แล้ว": "Checklist updated",
  ผู้รับผิดชอบในหมวดนี้: "Assignees in this category",
  "รายการที่เพิ่มเองจะบันทึกเข้า Master ของคุณด้วย":
    "Items you add are also saved to your Master list",
});
Object.assign(EN_TEXT, {
  เลือกรายการที่ต้องการเพิ่มเข้าทริปนี้: "Choose items to add to this trip",
  "เพิ่มรายการจาก Master ครบแล้ว": "All Master items have been added",
  เลือกผู้รับผิดชอบ: "Choose assignee",
  นำผู้รับผิดชอบออกจากรายการนี้: "Remove the assignee from this item",
  เจ้าของทริป: "Trip owner",
  "แก้ไข Checklist": "Edit checklist",
  "ชื่อใหม่จะอัปเดตใน Master ของคุณด้วย":
    "The new name will also update your Master list",
});
Object.assign(EN_TEXT, {
  ค้นหาสถานที่หรือรายการ: "Search places or items",
  ล้างการค้นหา: "Clear search",
  ไม่พบสถานที่หรือรายการในทริปนี้: "No matching places or items in this trip",
});
function translateUiText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  let translated = EN_TEXT[trimmed];
  if (trimmed === "วัน" && /^\s/.test(value)) translated = "days";
  if (trimmed === "รายการ" && /^\s/.test(value)) translated = "items";
  if (!translated && /^\d+ ทริป$/.test(trimmed))
    translated = `${trimmed.split(" ")[0]} trips`;
  if (!translated) {
    const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
      [/^กำลังจะมาถึงในอีก (\d+) วัน$/, (m) => `Upcoming in ${m[1]} days`],
      [/^อีก (\d+) วัน$/, (m) => `In ${m[1]} days`],
      [/^(\d+) วัน$/, (m) => `${m[1]} days`],
      [/^(\d+) ทริปที่รอเราอยู่$/, (m) => `${m[1]} upcoming trips`],
      [/^แผนวันที่ (\d+)(.*)$/, (m) => `Day ${m[1]} plan${m[2]}`],
      [/^Day (\d+) ยังว่างอยู่$/, (m) => `Day ${m[1]} is empty`],
      [
        /^(\d+) สถานที่ · เรียงตามเวลาอัตโนมัติ$/,
        (m) => `${m[1]} places · sorted automatically`,
      ],
      [/^(\d+) สถานที่$/, (m) => `${m[1]} places`],
      [/^(\d+) รายการค่าใช้จ่าย$/, (m) => `${m[1]} expenses`],
      [/^(\d+) รายการ$/, (m) => `${m[1]} items`],
      [
        /^เวลาปัจจุบัน (.+?) · (.*)$/,
        (m) => `Current time ${m[1]} · ${translateUiText(m[2])}`,
      ],
      [
        /^ไป (.+?) · กลับ (.+?) · (\d+) วัน$/,
        (m) => `Depart ${m[1]} · Return ${m[2]} · ${m[3]} days`,
      ],
      [
        /^ใช้ไป (.+) บาท จากงบ (.+) บาท$/,
        (m) => `Spent ${m[1]} baht from a ${m[2]} baht budget`,
      ],
      [/^เพิ่มรายการวันที่ (\d+)$/, (m) => `Add item to day ${m[1]}`],
      [/^เพิ่มค่าใช้จ่าย Day (\d+)$/, (m) => `Add expense to Day ${m[1]}`],
      [
        /^Day (\d+) ยังไม่มี Timeline$/,
        (m) => `Day ${m[1]} has no Timeline items`,
      ],
      [/^เพิ่ม Checklist “(.+)”$/, (m) => `Added checklist “${m[1]}”`],
      [/^แก้ไข Checklist “(.+)”$/, (m) => `Updated checklist “${m[1]}”`],
      [/^ลบ Checklist “(.+)”$/, (m) => `Deleted checklist “${m[1]}”`],
      [/^เพิ่มเอกสาร “(.+)”$/, (m) => `Added document “${m[1]}”`],
      [/^ลบเอกสาร “(.+)”$/, (m) => `Deleted document “${m[1]}”`],
      [/^เพิ่มแผน “(.+)”$/, (m) => `Added plan “${m[1]}”`],
      [/^แก้ไขแผน “(.+)”$/, (m) => `Updated plan “${m[1]}”`],
      [/^ลบแผน “(.+)”$/, (m) => `Deleted plan “${m[1]}”`],
      [/^ลบทริป “(.+)”\?$/, (m) => `Delete trip “${m[1]}”?`],
      [
        /^ลบ “(.+)” ออกจาก Checklist\?$/,
        (m) => `Remove “${m[1]}” from the checklist?`,
      ],
      [
        /^ลบหมวด “(.+)” และ (\d+) รายการที่คุณเพิ่มออกจากทริปนี้\?$/,
        (m) =>
          `Remove category “${m[1]}” and your ${m[2]} items from this trip?`,
      ],
      [/^ลบผู้ร่วมทริป “(.+)”\?$/, (m) => `Remove collaborator “${m[1]}”?`],
      [/^ออกจากทริป “(.+)”\?$/, (m) => `Leave trip “${m[1]}”?`],
      [/^ปฏิเสธคำเชิญ “(.+)”\?$/, (m) => `Decline invitation “${m[1]}”?`],
      [/^ลบ “(.+)”\?$/, (m) => `Delete “${m[1]}”?`],
    ];
    for (const [pattern, replacer] of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        translated = replacer(match);
        break;
      }
    }
  }
  return translated ? value.replace(trimmed, translated) : value;
}
const LanguageContext = createContext<Lang>("TH");
function useT() {
  const lang = useContext(LanguageContext);
  return (value: string) => (lang === "EN" ? translateUiText(value) : value);
}
let tripListCache: Trip[] | null = null;
const NAVIGATION_TOAST_KEY = "bn-trip-navigation-toast";
const tripReviewSummaryCache = new Map<
  string,
  { average: number; count: number }
>();

function applyCachedTripReviewSummary(trip: Trip): Trip {
  const summary = tripReviewSummaryCache.get(trip.id);
  return summary
    ? {
        ...trip,
        review_average: summary.average,
        review_count: summary.count,
      }
    : trip;
}

function applyCachedTripReviewSummaries(trips: Trip[]): Trip[] {
  if (!tripReviewSummaryCache.size) return trips;
  return trips.map(applyCachedTripReviewSummary);
}
const itineraryCache = new Map<string, Itinerary[]>();

function TripCountryFlag({ trip }: { trip: Trip }) {
  const country =
    countryByCode(trip.country_code) ||
    inferTripCountry(
      [trip.destination, trip.country_name].filter(Boolean).join(", "),
      trip.timezone,
    );
  return (
    <span
      className="trip-country-flag"
      role="img"
      aria-label={country.nameEn}
      title={country.nameEn}
    >
      {country.flag}
    </span>
  );
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Pack & Go+ · หน้าแรก">
      <Image
        src="/pack-and-go-icon-512.png"
        alt="Pack & Go+"
        width={48}
        height={48}
        priority
      />
      <div>
        Pack &amp; Go+<small>travel smarter together</small>
      </div>
    </Link>
  );
}

function AccountAvatar({
  profile,
  size = "medium",
}: {
  profile: AccountProfile | null;
  size?: "small" | "medium" | "large";
}) {
  const label = (profile?.display_name || profile?.email || "Pack & Go+").trim();
  const initial = label.charAt(0).toUpperCase();
  return (
    <span
      className={`account-avatar account-avatar-${size}`}
      aria-label={label}
    >
      <span
        className="account-avatar-image"
        style={
          profile?.avatar_url
            ? { backgroundImage: `url("${profile.avatar_url}")` }
            : undefined
        }
      >
        {!profile?.avatar_url && initial}
      </span>
    </span>
  );
}

function SharedTripAvatars({
  members = [],
  variant = "card",
  limit = 3,
  onClick,
  actionLabel,
}: {
  members?: TripMember[];
  variant?: "card" | "compact" | "header";
  limit?: number;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const t = useT();
  if (!members.length) return null;
  const owner = members.find((member) => member.role === "owner");
  const collaborators = members.filter((member) => member.role !== "owner");
  const visibleCollaborators = collaborators.slice(
    0,
    owner ? Math.max(0, limit - 1) : limit,
  );
  const hidden = Math.max(
    0,
    collaborators.length - visibleCollaborators.length,
  );
  const avatar = (member: TripMember) => {
    const label = (member.display_name || member.email || "?").trim();
    return (
      <span
        key={member.id}
        className={`shared-trip-avatar ${member.role === "owner" ? "shared-trip-avatar-owner" : "shared-trip-avatar-collaborator"}`}
        title={label}
        style={
          member.avatar_url
            ? { backgroundImage: `url("${member.avatar_url}")` }
            : undefined
        }
      >
        {!member.avatar_url && label.charAt(0).toUpperCase()}
      </span>
    );
  };
  const content = (
    <>
      {visibleCollaborators.map(avatar)}
      {hidden > 0 && (
        <span className="shared-trip-avatar shared-trip-more">+{hidden}</span>
      )}
      {owner && avatar(owner)}
    </>
  );
  const label =
    actionLabel ||
    (members.length > 1
      ? t(`แชร์ทริปกับ ${members.length - 1} คน`)
      : t("เจ้าของทริป"));
  if (onClick) {
    return (
      <button
        type="button"
        className={`shared-trip-avatars shared-trip-avatars-${variant} is-interactive`}
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        {content}
      </button>
    );
  }
  return (
    <div
      className={`shared-trip-avatars shared-trip-avatars-${variant}`}
      aria-label={label}
    >
      {content}
    </div>
  );
}

function TripRatingBadge({
  trip,
  variant = "cover",
  showEmpty = false,
  onClick,
}: {
  trip: Trip;
  variant?: "cover" | "compact" | "header";
  showEmpty?: boolean;
  onClick?: () => void;
}) {
  const t = useT();
  const average = Number(trip.review_average || 0);
  const count = Number(trip.review_count || 0);
  if ((!count || average <= 0) && !showEmpty) return null;
  const score = count && average > 0 ? average.toFixed(1) : "-";
  const label = `${t("รีวิวทริป")} ${score} (${count})`;
  const content = (
    <>
      <Star size={13} fill="currentColor" />
      <b>{score}</b>
      <small>({count})</small>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={`trip-rating-badge trip-rating-badge-${variant} is-interactive`}
        onClick={onClick}
        aria-label={label}
        title={label}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      className={`trip-rating-badge trip-rating-badge-${variant}`}
      aria-label={label}
      title={label}
    >
      {content}
    </span>
  );
}

const ownerLastTripMembers = (members: TripMember[]) =>
  [...members].sort(
    (left, right) =>
      Number(left.role === "owner") - Number(right.role === "owner"),
  );

function CollaboratorAvatar({ item }: { item: Collaborator }) {
  const label = (item.display_name || item.email || "?").trim();
  return (
    <span
      className="collaborator-avatar"
      title={label}
      style={
        item.avatar_url
          ? { backgroundImage: `url("${item.avatar_url}")` }
          : undefined
      }
    >
      {!item.avatar_url && label.charAt(0).toUpperCase()}
    </span>
  );
}

function CardBrandLogo({
  brand,
  className = "",
}: {
  brand?: CardBrand | null;
  className?: string;
}) {
  const asset = brand === "visa" ? "visa-wordmark" : brand || "card";
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
      className={`card-brand-logo card-brand-${brand || "generic"} ${className}`}
    >
      <Image
        src={`/card-brands/${asset}.svg`}
        alt={label}
        width={48}
        height={28}
      />
    </span>
  );
}

const ExpenseTripMembersContext = createContext<TripMember[]>([]);
function CashPaymentIcon({ className = "" }: { className?: string }) {
  const members = useContext(ExpenseTripMembersContext);
  const orderedMembers = ownerLastTripMembers(members);
  if (className.includes("expense-cash-mark") && members.length)
    return (
      <span
        className="expense-cash-members"
        aria-label={members
          .map((member) => member.display_name || member.email)
          .filter(Boolean)
          .join(", ")}
      >
        {orderedMembers.map((member) => {
          const label = (member.display_name || member.email || "?").trim();
          return (
            <span
              key={member.id}
              className="expense-cash-avatar"
              title={label}
              style={
                member.avatar_url
                  ? { backgroundImage: `url("${member.avatar_url}")` }
                  : undefined
              }
            >
              {!member.avatar_url && label.charAt(0).toUpperCase()}
            </span>
          );
        })}
      </span>
    );
  return (
    <span className={`cash-payment-icon ${className}`} aria-hidden="true" />
  );
}
function PaymentOwnerAvatar({
  card,
  className = "",
}: {
  card: PaymentCard;
  className?: string;
}) {
  const label = (card.owner_name || card.owner_email || "?").trim();
  return (
    <span
      className={`payment-owner-avatar ${className}`}
      title={label}
      style={
        card.owner_avatar_url
          ? { backgroundImage: `url("${card.owner_avatar_url}")` }
          : undefined
      }
    >
      {!card.owner_avatar_url && label.charAt(0).toUpperCase()}
    </span>
  );
}
function cardPaymentLabel(card: PaymentCard) {
  return `${card.nickname} · x-${card.last_four}`;
}
function tripCardPaymentLabel(card: PaymentCard) {
  return card.owner_name
    ? `${card.owner_name} · ${cardPaymentLabel(card)}`
    : cardPaymentLabel(card);
}
function findPaymentCard(
  cards: PaymentCard[],
  costOrMethod?: CostItem | string,
) {
  const cardId =
    typeof costOrMethod === "object" ? costOrMethod.creditCardId : undefined;
  const method =
    typeof costOrMethod === "string"
      ? costOrMethod
      : costOrMethod?.paymentMethod;
  return (
    cards.find((card) => card.id === cardId) ||
    cards.find(
      (card) =>
        cardPaymentLabel(card) === (method || "") ||
        tripCardPaymentLabel(card) === (method || ""),
    )
  );
}

function EmptyState({
  title,
  description,
  action,
  onClick,
  icon: Icon = Navigation,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  icon?: typeof Navigation;
}) {
  const t = useT();
  return (
    <article className="card empty-state">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{t(title)}</h3>
      <p>{t(description)}</p>
      <button className="primary-btn" onClick={onClick}>
        <Plus size={16} />
        {t(action)}
      </button>
    </article>
  );
}

function localDate(value: string | null | undefined, fallback = "") {
  return value ? value.slice(0, 10) : fallback.slice(0, 10);
}
function localTime(value: string | null | undefined, fallback = "09:00") {
  return value?.slice(11, 16) || fallback;
}
function addDays(dateValue: string, days: number) {
  const [year, month, date] = dateValue.slice(0, 10).split("-").map(Number);
  if (!year || !month || !date) return "";
  return new Date(Date.UTC(year, month - 1, date + days))
    .toISOString()
    .slice(0, 10);
}
function tripDayLabel(dateValue: string, day: number) {
  const value = addDays(dateValue, day - 1);
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(
        activeLang === "EN" ? "en-GB" : "th-TH",
        { day: "numeric", month: "short", year: "2-digit" },
      )
    : "";
}
function displayTripDay(
  trip: Pick<Trip, "has_day_zero"> | null | undefined,
  storedDay: number,
) {
  return storedDay - Number(Boolean(trip?.has_day_zero));
}
function tripRangeLabel(trip: Trip) {
  const label = (value: string | null) => {
    if (!value) return activeLang === "EN" ? "Not specified" : "ยังไม่ระบุ";
    const [date, time = ""] = value.split("T");
    const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(
      activeLang === "EN" ? "en-GB" : "th-TH",
      { day: "numeric", month: "short", year: "2-digit" },
    );
    return `${dateLabel} (${time.slice(0, 5)})`;
  };
  return `${label(trip.outbound_departure_at)} - ${label(trip.return_departure_at)}`;
}
function tripHeaderRangeLabel(trip: Trip) {
  const label = (value: string | null) => {
    if (!value) return activeLang === "EN" ? "Not specified" : "ยังไม่ระบุ";
    const date = value.slice(0, 10);
    return new Date(`${date}T00:00:00`).toLocaleDateString(
      activeLang === "EN" ? "en-GB" : "th-TH",
      { day: "numeric", month: "short", year: "2-digit" },
    );
  };
  return activeLang === "EN"
    ? `${label(trip.outbound_departure_at)} - ${label(trip.return_departure_at)} (${trip.total_days} days)`
    : `${label(trip.outbound_departure_at)} - ${label(trip.return_departure_at)} (${trip.total_days} วัน)`;
}
function moneyFormat(value: string | number) {
  const clean = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  if (!clean) return "";
  const [whole, decimal] = clean.split(".");
  return `${Number(whole || 0).toLocaleString("en-US")}${decimal !== undefined ? `.` + decimal.slice(0, 2) : ""}`;
}
function bahtFormat(value: number | string) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function costSourceLabel(cost: CostItem) {
  return `${Number(cost.foreignAmount ?? cost.value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cost.currency || "THB"}`;
}
function MoneyInput({
  name,
  defaultValue,
  required = false,
}: {
  name: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  const [value, setValue] = useState(() => moneyFormat(defaultValue ?? ""));
  return (
    <input
      name={name}
      inputMode="decimal"
      value={value}
      required={required}
      onChange={(e) => setValue(moneyFormat(e.target.value))}
    />
  );
}
function NativeDateTimeInput({
  name,
  type,
  defaultValue,
  required = false,
  label,
  value: controlledValue,
  onValueChange,
  min,
  disabled = false,
}: {
  name: string;
  type: "date" | "time";
  defaultValue: string;
  required?: boolean;
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  disabled?: boolean;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const locale = activeLang === "EN" ? "en-GB" : "th-TH-u-ca-gregory";
  const display =
    type === "date" && value
      ? new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : value ||
        (type === "date"
          ? activeLang === "EN"
            ? "Choose date"
            : "เลือกวันที่"
          : activeLang === "EN"
            ? "Choose time"
            : "เลือกเวลา");
  const Icon = type === "date" ? CalendarDays : Clock;
  return (
    <label className={`native-picker-control ${disabled ? "disabled" : ""}`}>
      <span className="native-picker-value">{display}</span>
      <Icon size={18} aria-hidden="true" />
      <input
        aria-label={label}
        lang={locale}
        name={name}
        type={type}
        value={value}
        min={min}
        disabled={disabled}
        required={required}
        onChange={(event) => {
          setInternalValue(event.target.value);
          onValueChange?.(event.target.value);
        }}
      />
    </label>
  );
}
function zonedClock(now: Date, timezone = "Asia/Bangkok") {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value || "00";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      minutes: Number(get("hour")) * 60 + Number(get("minute")),
    };
  } catch {
    return {
      date: now.toISOString().slice(0, 10),
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}
function tripDayAt(trip: Trip, now: Date) {
  const value = localDate(trip.outbound_departure_at, trip.start_date);
  const [year, month, date] = value.split("-").map(Number);
  const todayValue = zonedClock(now, trip.timezone).date;
  const [todayYear, todayMonth, todayDate] = todayValue.split("-").map(Number);
  if (!year || !month || !date) return null;
  return (
    Math.floor(
      (Date.UTC(todayYear, todayMonth - 1, todayDate) -
        Date.UTC(year, month - 1, date)) /
        86400000,
    ) + 1
  );
}
function tripHasEnded(trip: Trip, now: Date) {
  const clock = zonedClock(now, trip.timezone);
  if (trip.return_departure_at)
    return (
      `${clock.date}T${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}` >
      trip.return_departure_at.slice(0, 16)
    );
  const dayAfterTrip = addDays(trip.start_date, trip.total_days);
  return Boolean(dayAfterTrip && clock.date >= dayAfterTrip);
}
function tripTemporalStatus(trip: Trip, nowValue: Date | number) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const clock = zonedClock(now, trip.timezone);
  const time = `${String(Math.floor(clock.minutes / 60)).padStart(2, "0")}:${String(clock.minutes % 60).padStart(2, "0")}`;
  const nowKey = `${clock.date}T${time}`;
  const departure = (
    trip.outbound_departure_at || `${trip.start_date}T00:00`
  ).slice(0, 16);
  const returnAt = (
    trip.return_departure_at ||
    `${addDays(trip.start_date, trip.total_days - 1)}T23:59`
  ).slice(0, 16);
  const [sy, sm, sd] = departure.slice(0, 10).split("-").map(Number);
  const [ny, nm, nd] = clock.date.split("-").map(Number);
  return {
    ongoing: departure <= nowKey && returnAt >= nowKey,
    past: returnAt < nowKey,
    daysUntil: Math.max(
      0,
      Math.ceil(
        (Date.UTC(sy, sm - 1, sd) - Date.UTC(ny, nm - 1, nd)) / 86400000,
      ),
    ),
  };
}
function timeInMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute)
    ? hour * 60 + minute
    : null;
}
function shiftedPlanTime(value: string | null | undefined) {
  const minutes = timeInMinutes(value?.slice(0, 5) || null);
  if (minutes === null || minutes + 60 >= 24 * 60) return "09:00";
  const next = minutes + 60;
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}
function nextPlanTime(items: Itinerary[], day: number) {
  const latest = items
    .filter((item) => item.day_number === day && item.start_time)
    .map((item) => item.start_time!.slice(0, 5))
    .sort()
    .at(-1);
  return latest ? shiftedPlanTime(latest) : "09:00";
}
function withoutFirstTransport(items: Itinerary[]) {
  const firstByDay = new Map<number, Itinerary>();
  for (const item of items) {
    const first = firstByDay.get(item.day_number);
    if (
      !first ||
      (item.start_time || "99:99").localeCompare(
        first.start_time || "99:99",
      ) < 0
    )
      firstByDay.set(item.day_number, item);
  }
  const firstIds = new Set([...firstByDay.values()].map((item) => item.id));
  return items.map((item) =>
    firstIds.has(item.id) && item.transport_mode
      ? { ...item, transport_mode: null }
      : item,
  );
}
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

/* Timeline images are intentionally disabled to keep dense daily plans compact.
function TimelineImagePicker({existingUrl,onChange}:{existingUrl?:string|null;onChange:(file:File|null)=>void}){
  const inputRef=useRef<HTMLInputElement>(null);const canvasRef=useRef<HTMLCanvasElement>(null);const objectUrls=useRef<string[]>([]);
  const [source,setSource]=useState<CropSource|null>(null);const [preview,setPreview]=useState(existingUrl||"");const [cropping,setCropping]=useState(false);const [zoom,setZoom]=useState(1);const [positionX,setPositionX]=useState(0);const [positionY,setPositionY]=useState(0);const [error,setError]=useState("");
  useEffect(()=>()=>{objectUrls.current.forEach(url=>URL.revokeObjectURL(url))},[]);
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas||!source)return;const context=canvas.getContext("2d");if(!context)return;const outputWidth=640;const outputHeight=360;const imageWidth=source.image.naturalWidth;const imageHeight=source.image.naturalHeight;const scale=Math.max(outputWidth/imageWidth,outputHeight/imageHeight)*zoom;const visibleWidth=outputWidth/scale;const visibleHeight=outputHeight/scale;const centerX=imageWidth/2+(positionX/100)*(imageWidth-visibleWidth)/2;const centerY=imageHeight/2+(positionY/100)*(imageHeight-visibleHeight)/2;const sx=Math.max(0,Math.min(imageWidth-visibleWidth,centerX-visibleWidth/2));const sy=Math.max(0,Math.min(imageHeight-visibleHeight,centerY-visibleHeight/2));context.clearRect(0,0,outputWidth,outputHeight);context.drawImage(source.image,sx,sy,visibleWidth,visibleHeight,0,0,outputWidth,outputHeight)},[source,zoom,positionX,positionY]);
  function select(event:React.ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;setError("");if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError("รองรับเฉพาะ JPG, PNG และ WebP");return}if(file.size>8*1024*1024){setError("รูปต้องมีขนาดไม่เกิน 8 MB");return}const url=URL.createObjectURL(file);objectUrls.current.push(url);const image=new window.Image();image.onload=()=>{setSource({file,image,url});setZoom(1);setPositionX(0);setPositionY(0);setCropping(true)};image.onerror=()=>setError("ไม่สามารถอ่านไฟล์รูปนี้ได้");image.src=url}
  async function applyCrop(){const canvas=canvasRef.current;if(!canvas||!source)return;const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.78));if(!blob){setError("ไม่สามารถ Crop รูปได้");return}const baseName=source.file.name.replace(/\.[^.]+$/,"")||"timeline";const croppedFile=new File([blob],`${baseName}-timeline.jpg`,{type:"image/jpeg"});const url=URL.createObjectURL(blob);objectUrls.current.push(url);setPreview(url);setCropping(false);onChange(croppedFile)}
  function cancelCrop(){setCropping(false);setSource(null);if(inputRef.current)inputRef.current.value=""}
  return <div className="timeline-image-control">{!cropping&&<label className={`timeline-image-picker ${preview?"has-image":""}`} title="เลือกรูป Timeline" aria-label="เลือกรูป Timeline" style={preview?{backgroundImage:`url("${preview}")`}:undefined}><ImagePlus size={20}/><span>{preview?"เปลี่ยนรูป":"เพิ่มรูป"}</span><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={select}/></label>}{cropping&&<div className="timeline-cropper"><div className="timeline-crop-head"><strong>จัดตำแหน่งรูป 16:9</strong><button type="button" onClick={cancelCrop}>ยกเลิก</button></div><div className="timeline-crop-canvas"><canvas ref={canvasRef} width={640} height={360}/></div><div className="timeline-crop-controls"><label><span>ซูม</span><input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label><label><span>ซ้าย–ขวา</span><input type="range" min="-100" max="100" value={positionX} onChange={event=>setPositionX(Number(event.target.value))}/></label><label><span>บน–ล่าง</span><input type="range" min="-100" max="100" value={positionY} onChange={event=>setPositionY(Number(event.target.value))}/></label></div><button type="button" className="timeline-crop-apply" onClick={applyCrop}>ใช้รูปนี้</button></div>}{error&&<p className="cover-error">{error}</p>}</div>;
}
*/

function LoginScreen({ authError }: { authError?: string }) {
  const t = useT();
  const error = authError
    ? authError === "google_not_configured"
      ? "ยังไม่ได้ตั้งค่า Google OAuth"
      : authError === "demo_login_required"
        ? "เข้าสู่ระบบเพื่อเพิ่ม แก้ไข หรือลบข้อมูล"
        : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ"
    : "";
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="login-art-top">
          <Brand />
          <span className="login-private-pill">
            <Crown size={12} />
            {t("พื้นที่ส่วนตัว")}
          </span>
        </div>
        <div className="login-hero-copy">
          <div className="eyebrow">
            <Sparkles size={13} /> private journeys · made together
          </div>
          <h1>
            {t("เก็บทุกเส้นทาง")}
            <br />
            {t("ไว้ในที่เดียว")}
          </h1>
          <p>
            {t("แพลนที่เที่ยว จดโมเมนต์ และคุมงบ")}
            <br />
            {t("ในสมุดเดินทางของ B & N")}
          </p>
          <div className="login-route">
            <span>BKK</span>
            <div>
              <Plane size={20} />
            </div>
            <span>ANYWHERE</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <span className="login-sheet-handle" aria-hidden="true" />
        <div className="login-copy">
          <span className="mini-kicker">WELCOME BACK</span>
          <h2>{t("เปิดสมุดเดินทาง")}</h2>
          <p>{t("เข้าสู่ระบบด้วย Google Account ของคุณ")}</p>
        </div>
        {error && <p className="login-error">{t(error)}</p>}
        <a className="primary-btn google-login-btn" href="/api/auth/google">
          <span className="google-mark">G</span>
          <span>{t("เข้าสู่ระบบด้วย Google")}</span>
          <ArrowRight size={17} />
        </a>
        <a className="demo-login-btn" href="/api/auth/demo">
          <Sparkles size={16} />
          <span>{t("ทดลองใช้ก่อน")}</span>
          <ArrowRight size={16} />
        </a>
        <p className="login-hint">
          <Crown size={12} />
          {t("ทุกบัญชี Google สามารถเริ่มสร้างทริปได้")}
        </p>
      </section>
    </main>
  );
}

function TripCard({
  trip,
  past,
  now,
  selectTrip,
  priority = false,
}: {
  trip: Trip;
  past?: boolean;
  now: number;
  selectTrip: (t: Trip) => void;
  priority?: boolean;
}) {
  const t = useT();
  const coverUrl = trip.cover_image_url || DEFAULT_TRIP_COVER;
  const temporal = tripTemporalStatus(trip, now);
  const budget = Number(trip.budget_thb || 0);
  const actualSpent = Number(trip.actual_spent_thb || 0);
  const ongoing = temporal.ongoing;
  const countdownLabel = !trip.outbound_departure_at
    ? t("ยังไม่กำหนดวัน")
    : ongoing
      ? t("กำลังเดินทาง")
      : t(`กำลังจะมาถึงในอีก ${temporal.daysUntil} วัน`);
  return (
    <article
      className={`trip-card ${past ? "past" : ""} ${trip.members?.length ? "has-shared-members" : ""}`}
    >
      <button
        className="trip-card-link"
        onClick={() => selectTrip(trip)}
        aria-label={`${past ? "View" : "Open"} trip ${trip.name}`}
      />
      <div className="trip-cover">
        <TripCoverImage
          src={coverUrl}
          alt={`รูปปก ${trip.name}`}
          sizes="(max-width: 600px) calc(100vw - 32px), 520px"
          priority={priority}
          className="trip-cover-image"
        />
        <span />
        {!past && trip.has_incomplete_setup && (
          <i
            className="notification-dot home-trip-notification-dot"
            aria-label={t("ข้อมูลทริปยังไม่ครบ")}
          />
        )}
        {past ? (
          <b className="past-badge">{t("ที่ผ่านมาแล้ว")}</b>
        ) : (
          <b
            className={`countdown-badge ${ongoing ? "ongoing-badge" : "upcoming-badge"}`}
          >
            <span>{countdownLabel}</span>
          </b>
        )}
        <SharedTripAvatars members={trip.members} limit={3} />
        {past && <TripRatingBadge trip={trip} />}
      </div>
      <div className="trip-body">
        <h3>{trip.name}</h3>
        <p>
          <TripCountryFlag trip={trip} />
          {formatTripDestination(
            trip.destination,
            trip.country_code,
            trip.country_name,
          )}
        </p>
        <span className="trip-duration">
          {tripRangeLabel(trip)} · ({t(`${trip.total_days} วัน`)})
        </span>
        <div className="trip-meta">
          <span>{t("งบ")} ฿{budget.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
          <span className={actualSpent > budget && budget > 0 ? "is-over-budget" : "is-actual-spent"}>
            {t("ใช้จริง")} ฿{actualSpent.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </article>
  );
}

function TripInvitations({
  revision,
  onChanged,
  notify,
  confirmAction,
}: {
  revision: number;
  onChanged: () => void;
  notify: (message: string) => void;
  confirmAction: (confirmation: Confirmation) => void;
}) {
  const t = useT();
  const [items, setItems] = useState<TripInvitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/invitations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function accept(invitation: TripInvitation) {
    setBusyId(invitation.id);
    try {
      const response = await fetch(`/api/invitations/${invitation.id}`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      notify("ตอบรับคำเชิญแล้ว");
      onChanged();
    } finally {
      setBusyId(null);
    }
  }
  async function decline(invitation: TripInvitation) {
    const response = await fetch(`/api/invitations/${invitation.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setItems((current) => current.filter((item) => item.id !== invitation.id));
    notify("ปฏิเสธคำเชิญแล้ว");
  }
  function askDecline(invitation: TripInvitation) {
    confirmAction({
      title: `ปฏิเสธคำเชิญ “${invitation.trip_name}”?`,
      description: "คำเชิญนี้จะถูกลบออก และทริปจะไม่ถูกเพิ่มในรายการของคุณ",
      confirmLabel: "ปฏิเสธ",
      busyLabel: "กำลังปฏิเสธ…",
      onConfirm: () => decline(invitation),
    });
  }
  if (!items.length) return null;
  return (
    <section className="trip-invitations">
      <div className="section-head">
        <div>
          <span className="section-kicker">TRIP INVITATIONS</span>
          <h2>{t("คำเชิญเข้าร่วมทริป")}</h2>
          <p>
            {items.length} {t("รายการ")}
          </p>
        </div>
      </div>
      <div className="trip-invitation-list">
        {items.map((invitation) => {
          const owner: AccountProfile = {
            id: `owner-${invitation.id}`,
            email: invitation.owner_email,
            display_name: invitation.owner_name || invitation.owner_email,
            avatar_url: invitation.owner_avatar_url,
          };
          return (
            <article className="trip-invitation-card" key={invitation.id}>
              <div className="trip-invitation-cover">
                <TripCoverImage
                  src={invitation.cover_image_url || DEFAULT_TRIP_COVER}
                  alt={`รูปปก ${invitation.trip_name}`}
                  sizes="74px"
                  className="trip-invitation-cover-image"
                />
              </div>
              <div className="trip-invitation-copy">
                <h3>{invitation.trip_name}</h3>
                <p>
                  <MapPin size={11} />
                  {invitation.destination}
                </p>
                <small>
                  <AccountAvatar profile={owner} size="small" />
                  <span>
                    <b>{owner.display_name}</b>
                    {t("เชิญคุณเข้าร่วมทริป")}
                  </span>
                </small>
              </div>
              <div className="trip-invitation-actions">
                <button
                  type="button"
                  className="invitation-accept"
                  onClick={() => void accept(invitation)}
                  disabled={busyId !== null}
                >
                  <CheckCircle2 size={15} />
                  {t(busyId === invitation.id ? "กำลังยอมรับ…" : "ยอมรับ")}
                </button>
                <button
                  type="button"
                  className="invitation-decline"
                  onClick={() => askDecline(invitation)}
                  disabled={busyId !== null}
                  aria-label={t("ปฏิเสธ")}
                  title={t("ปฏิเสธ")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NearbyFlights({
  openFlightTrip,
  notify,
}: {
  openFlightTrip: (tripId: string) => void;
  notify: (message: string) => void;
}) {
  const t = useT();
  const [flights, setFlights] = useState<NearbyFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncConfigured, setSyncConfigured] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const now = useMinuteClock().getTime();
  useEffect(() => {
    let active = true;
    const apply = (body: { flights?: NearbyFlight[]; syncConfigured?: boolean }) => {
      if (!active) return;
      if (Array.isArray(body.flights)) setFlights(body.flights);
      if (typeof body.syncConfigured === "boolean") setSyncConfigured(body.syncConfigured);
    };
    void fetch("/api/flights/nearby", { cache: "no-store" })
      .then((response) => response.json())
      .then(apply)
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const refreshStale = () => {
      void fetch("/api/flights/nearby", { method: "POST", cache: "no-store" })
        .then((response) => response.json())
        .then(apply)
        .catch(() => {});
    };
    refreshStale();
    const timer = window.setInterval(refreshStale, 2 * 60 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshStale();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  async function syncFlight(flight: NearbyFlight) {
    if (!syncConfigured || syncingId) return;
    setSyncingId(flight.id);
    try {
      const response = await fetch(`/api/trips/${flight.trip_id}/flights/${flight.id}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "อัปเดตเที่ยวบินไม่สำเร็จ");
      const refreshed = await fetch("/api/flights/nearby", { cache: "no-store" });
      const latest = await refreshed.json();
      if (refreshed.ok && Array.isArray(latest.flights)) setFlights(latest.flights);
      notify("อัปเดตข้อมูลเที่ยวบินแล้ว");
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "อัปเดตเที่ยวบินไม่สำเร็จ");
    } finally {
      setSyncingId(null);
    }
  }
  if (!loading && !flights.length) return null;
  return (
    <section className="nearby-flight-section">
      <div className="section-head nearby-flight-heading">
        <div>
          <span className="section-kicker">LIVE FLIGHT</span>
          <div className="section-title-row">
            <h2>{t("เที่ยวบินใกล้ออก")}</h2>
            <span className="section-trip-count">{t("ล่วงหน้า 3 วัน")}</span>
          </div>
          <p>{t("Terminal, Gate และเวลาล่าสุดจะอัปเดตตามช่วงเวลา หรือกด Sync ได้ทันที")}</p>
        </div>
      </div>
      <div className="nearby-flight-list">
        {loading && !flights.length ? (
          <article className="nearby-flight-card is-loading">{t("กำลังตรวจเที่ยวบินล่าสุด…")}</article>
        ) : flights.map((flight) => {
          const departure = new Date(flight.latest_departure_at || flight.scheduled_departure_at);
          const arrival = new Date(flight.latest_arrival_at || flight.scheduled_arrival_at);
          const hasEnded = arrival.getTime() < now;
          const hours = Math.max(0, Math.ceil((departure.getTime() - now) / 3600000));
          const departureTime = flight.entered_departure_local_text?.slice(11, 16)
            || departure.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
          const arrivalTime = flight.entered_arrival_local_text?.slice(11, 16)
            || arrival.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
          const departureDay = flight.entered_departure_local_text?.slice(0, 10)
            ? new Date(`${flight.entered_departure_local_text.slice(0, 10)}T00:00:00`)
            : departure;
          const arrivalDay = flight.entered_arrival_local_text?.slice(0, 10)
            ? new Date(`${flight.entered_arrival_local_text.slice(0, 10)}T00:00:00`)
            : arrival;
          const airportName = (value: string) => value
            .replace(/\s+(?:International(?:\s+Airport)?|Intl\.?|Int['’]l\.?)$/i, "")
            .trim();
          return (
            <article
              className="flight-card flight-card-compact nearby-flight-card nearby-flight-card-full"
              key={flight.id}
              role="button"
              tabIndex={0}
              onClick={() => openFlightTrip(flight.trip_id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openFlightTrip(flight.trip_id);
                }
              }}
              aria-label={`${flight.airline_code} ${flight.flight_number} ${flight.departure_airport_code} ไป ${flight.arrival_airport_code}`}
            >
              <div className="flight-card-top nearby-flight-card-top">
                <div className="flight-card-identity">
                  <div className="flight-number">
                    <span><Plane className="flight-airline-icon" size={11} />{flight.airline_name || flight.airline_code}</span>
                    <strong>{flight.airline_code} {flight.flight_number}</strong>
                  </div>
                </div>
                <div className="nearby-flight-head-badges">
                  <div className="nearby-flight-status-stack"><span className={`flight-status status-${flight.status.toLowerCase().replace(/\s/g, "-")}`}>{flight.status || "scheduled"}</span><b>{hasEnded?t("เดินทางแล้ว"):hours < 24 ? t(`อีก ${hours} ชม.`) : t(`อีก ${Math.ceil(hours / 24)} วัน`)}</b></div>
                  {!hasEnded&&<button type="button" className={`icon-btn nearby-flight-sync ${syncingId === flight.id ? "is-syncing" : ""}`} disabled={!syncConfigured || Boolean(syncingId)} onClick={(event) => { event.stopPropagation(); void syncFlight(flight); }} aria-label={t("อัปเดตข้อมูลเที่ยวบินทันที")}><RefreshCw size={15} /></button>}
                </div>
              </div>
              <div className="flight-route-compact">
                <div className="flight-airport-block">
                  <span className="flight-route-label">{t("ต้นทาง")}</span>
                  <strong>{flight.departure_airport_code}</strong>
                  <em>{flight.departure_airport_name ? airportName(flight.departure_airport_name) : t("รอข้อมูลสนามบิน")}</em>
                  <b>{departureTime}</b>
                </div>
                <div className="flight-route-path"><small className="flight-route-date"><CalendarDays size={10}/><span>{departureDay.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span><i>→</i><span>{arrivalDay.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span></small><div className="flight-route-track"><span /><Plane size={23} /><span /></div></div>
                <div className="flight-airport-block is-arrival">
                  <span className="flight-route-label">{t("ปลายทาง")}</span>
                  <strong>{flight.arrival_airport_code}</strong>
                  <em>{flight.arrival_airport_name ? airportName(flight.arrival_airport_name) : t("รอข้อมูลสนามบิน")}</em>
                  <b>{arrivalTime}</b>
                </div>
              </div>
              <div className="flight-terminal-grid">
                <span>Terminal <b>{flight.departure_terminal || t("รออัปเดต")}</b> · Gate <b>{flight.departure_gate || t("รออัปเดต")}</b></span>
                <span>Terminal <b>{flight.arrival_terminal || t("รออัปเดต")}</b> · Gate <b>{flight.arrival_gate || t("รออัปเดต")}</b></span>
              </div>
              <FlightPassengerInfoList passengers={flight.passengers} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard({
  trips,
  counts,
  countryHighlights,
  revision,
  selectTrip,
  openFlightTrip,
  createTrip,
  viewAll,
  viewAnalytics,
  onInvitationChanged,
  notify,
  confirmAction,
}: {
  trips: Trip[];
  counts: DashboardCounts;
  countryHighlights: CountryHighlight[];
  revision: number;
  selectTrip: (t: Trip) => void;
  openFlightTrip: (tripId: string) => void;
  createTrip: () => void;
  viewAll: (status: TripStatus) => void;
  viewAnalytics: () => void;
  onInvitationChanged: () => void;
  notify: (message: string) => void;
  confirmAction: (confirmation: Confirmation) => void;
}) {
  const t = useT();
  const [now] = useState(() => Date.now());
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  useEffect(() => {
    let active = true;
    getCurrentAccount()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const { ongoing, upcoming, past } = useMemo(() => {
    const grouped = { ongoing: [] as Trip[], upcoming: [] as Trip[], past: [] as Trip[] };
    for (const trip of trips) {
      const status = tripTemporalStatus(trip, now);
      if (status.ongoing) grouped.ongoing.push(trip);
      else if (status.past) grouped.past.push(trip);
      else grouped.upcoming.push(trip);
    }
    return grouped;
  }, [now, trips]);
  const cards = (items: Trip[], isPast = false, prioritizeFirst = false) => (
    <div className="trip-grid">
      {items.map((trip, index) => (
        <TripCard
          key={trip.id}
          trip={trip}
          past={isPast}
          now={now}
          selectTrip={selectTrip}
          priority={prioritizeFirst && index === 0}
        />
      ))}
    </div>
  );
  const heading = (
    kicker: string,
    title: string,
    count: number,
    status: TripStatus,
    description?: string,
  ) => (
    <div className="section-head">
      <div>
        <span className="section-kicker">{kicker}</span>
        <div className="section-title-row">
          <h2>{t(title)}</h2>
          <span className="section-trip-count">{t(`${count} ทริป`)}</span>
        </div>
        {description && <p>{t(description)}</p>}
      </div>
      {count > 0 && status !== "ongoing" && (
        <button className="section-view-all" onClick={() => viewAll(status)}>
          {t("ดูทั้งหมด")}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
  return (
    <div className="screen">
      <section className="welcome">
        <button
          type="button"
          className="welcome-insights-btn"
          onClick={viewAnalytics}
          aria-label={t("สถิติการเดินทาง")}
        >
          <ChartNoAxesColumnIncreasing size={15} />
          <span>{t("สถิติ")}</span>
        </button>
        <div className="welcome-content">
          <div className="welcome-topline">
            {profile && (
              <div className="welcome-profile">
                <AccountAvatar profile={profile} size="small" />
                <div>
                  <small>{t("ยินดีต้อนรับกลับมา")}</small>
                  <strong>{profile.display_name}</strong>
                </div>
              </div>
            )}
          </div>
          <div className="welcome-copy">
            <span className="eyebrow">
              <Sparkles size={13} /> OUR TRAVEL JOURNAL
            </span>
            <h1>{t("เรื่องราวระหว่างทาง")}</h1>
            <p>{t("แพลนทริป หรือกลับมาเปิดดูความทรงจำเดิมได้ทุกเมื่อ")}</p>
          </div>
        </div>
        <div className="welcome-actions">
          <button className="primary-btn" onClick={createTrip}>
            <Plus size={17} />
            {t("สร้างทริปใหม่")}
          </button>
          <button className="welcome-all-btn" onClick={() => viewAll("all")}>
            {t("ดูทริปทั้งหมด")}
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
      {countryHighlights.length > 0 && (
        <PastCountryHighlights items={countryHighlights} />
      )}
      <TripInvitations
        revision={revision}
        onChanged={onInvitationChanged}
        notify={notify}
        confirmAction={confirmAction}
      />
      <NearbyFlights openFlightTrip={openFlightTrip} notify={notify} />
      {ongoing.length > 0 && (
        <>
          {heading(
            "HAPPENING NOW",
            "ทริปที่กำลังเดินทาง",
            counts.ongoing,
            "ongoing",
          )}
          {cards(ongoing, false, true)}
        </>
      )}
      {heading(
        "UPCOMING JOURNEYS",
        "ทริปที่กำลังจะมาถึง",
        counts.upcoming,
        "upcoming",
      )}
      {upcoming.length ? (
        cards(upcoming, false, ongoing.length === 0)
      ) : (
        <EmptyState
          title="หน้ากระดาษนี้ยังว่าง"
          description="สร้างทริปใหม่ แล้วเริ่มเติมสถานที่ที่อยากไปกัน"
          action="สร้างทริปใหม่"
          onClick={createTrip}
        />
      )}
      <div className="past-section">
        {heading(
          "PAST JOURNEYS",
          "ทริปที่ผ่านมาแล้ว",
          counts.past,
          "past",
          "ย้อนกลับไปดูเส้นทางและความทรงจำเดิมได้เสมอ",
        )}
        {past.length ? (
          cards(past, true)
        ) : (
          <article className="card past-empty">
            {t("เมื่อจบทริปแล้ว เราจะเก็บการเดินทางไว้ตรงนี้ให้อัตโนมัติ")}
          </article>
        )}
      </div>
    </div>
  );
}

function PastCountryHighlights({ items }: { items: CountryHighlight[] }) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const router = useRouter();
  return (
    <section className="country-highlights" aria-label={t("ประเทศที่ประทับใจ")}>
      <div className="country-highlights-head">
        <div>
          <span className="section-kicker">TRAVEL MEMORIES</span>
          <h2>{t("ประเทศที่ประทับใจ")}</h2>
        </div>
        <small>{t("เรียงตามคะแนนรีวิว")}</small>
      </div>
      <div className="country-highlights-scroll">
        {items.map((item) => {
          const country =
            countryByCode(item.countryCode) || inferTripCountry(item.country);
          const name = lang === "EN" ? country.nameEn : country.nameTh;
          return (
            <button
              type="button"
              className="country-highlight-item"
              key={`${item.countryCode}:${item.country}`}
              onClick={() =>
                router.push(
                  `/trips?status=past&q=${encodeURIComponent(country.nameEn)}`,
                )
              }
              title={`${name} · ${item.averageRating.toFixed(1)}`}
              aria-label={`${t("ดูทริปทั้งหมดใน")} ${name}`}
            >
              <div className="country-highlight-flag" role="img" aria-label={name}>
                <span>{country.flag}</span>
                {item.reviewCount > 0 && (
                  <b><Star size={9} fill="currentColor" />{item.averageRating.toFixed(1)}</b>
                )}
              </div>
              <strong>{name}</strong>
              <small>{t(`${item.trips} ทริป`)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnalyticsYearTrend({
  years,
  money,
  tripLabel,
}: {
  years: TravelAnalyticsPayload["years"];
  money: (value: number) => string;
  tripLabel: string;
}) {
  const chronological = [...years].reverse();
  const width = 320;
  const chartTop = 22;
  const chartBottom = 112;
  const maxTrips = Math.max(1, ...chronological.map((item) => item.trips));
  const step = chronological.length > 1 ? 272 / (chronological.length - 1) : 0;
  const points = chronological.map((item, index) => ({
    ...item,
    x: chronological.length > 1 ? 24 + index * step : width / 2,
    y: chartBottom - (item.trips / maxTrips) * (chartBottom - chartTop),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `M ${points[0].x} ${chartBottom} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points.at(-1)!.x} ${chartBottom} Z`
    : "";
  return (
    <div className="analytics-trend" role="img" aria-label="Trips by year">
      <svg viewBox={`0 0 ${width} 132`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="analytics-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff6b16" stopOpacity="0.28" />
            <stop offset="1" stopColor="#ffb05a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[42, 77, 112].map((y) => (
          <line key={y} x1="16" x2="304" y1={y} y2={y} className="analytics-trend-grid" />
        ))}
        <path d={area} fill="url(#analytics-area-gradient)" />
        <polyline points={line} className="analytics-trend-line" />
        {points.map((point) => (
          <g key={point.year}>
            <circle cx={point.x} cy={point.y} r="6" className="analytics-trend-point-ring" />
            <circle cx={point.x} cy={point.y} r="3.5" className="analytics-trend-point" />
          </g>
        ))}
      </svg>
      <div className="analytics-trend-labels">
        {points.map((point) => (
          <div key={point.year}>
            <b>{point.year}</b>
            <span>{point.trips} {tripLabel}</span>
            <small>{money(point.totalExpense)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TravelAnalyticsDashboard({
  datasets,
}: {
  datasets: TravelAnalyticsCollection;
}) {
  const t = useT();
  const [scope, setScope] = useState<TravelAnalyticsScope>("all");
  const data = datasets[scope];
  const money = (value: number) => `฿${bahtFormat(value)}`;
  const maxCountryTrips = Math.max(
    1,
    ...data.countries.map((item) => item.trips),
  );
  const expenseTotal = data.totals.travelExpense + data.totals.shoppingExpense;
  const travelShare = expenseTotal
    ? (data.totals.travelExpense / expenseTotal) * 100
    : 0;
  const flightInsights = data.flights;
  const maxAirlineFlights = Math.max(1, ...flightInsights.airlines.map((item) => item.flights));
  const maxPeriodFlights = Math.max(1, ...flightInsights.periods.map((item) => item.flights));
  const monthName = (month: number) =>
    new Intl.DateTimeFormat("th-TH", { month: "short" }).format(new Date(2026, month - 1, 1));
  const scopeFilter = (
    <nav className="analytics-scope-filter" aria-label={t("กรองสถิติการเดินทาง")}>
      {([
        ["all", "ทั้งหมด"],
        ["domestic", "ภายในประเทศ"],
        ["international", "ต่างประเทศ"],
      ] as const).map(([value, label]) => (
        <button
          className={scope === value ? "active" : ""}
          key={value}
          type="button"
          aria-pressed={scope === value}
          onClick={() => setScope(value)}
        >
          {t(label)}
        </button>
      ))}
    </nav>
  );

  if (!data.totals.trips)
    return (
      <div className="screen analytics-screen">
        <header className="analytics-heading">
          <span className="section-kicker">JOURNEY INSIGHTS</span>
          <h1>{t("สถิติการเดินทาง")}</h1>
          <p>{t("ภาพรวมจากทริปที่ผ่านมาแล้วเท่านั้น")}</p>
        </header>
        {scopeFilter}
        <article className="card analytics-empty">
          <ChartNoAxesColumnIncreasing size={28} />
          <h2>{t("ยังไม่มีทริปที่ผ่านมาให้สรุป")}</h2>
          <p>
            {t("เมื่อทริปจบแล้ว สถิติจะปรากฏที่หน้านี้โดยอัตโนมัติ")}
          </p>
        </article>
      </div>
    );

  return (
    <div className="screen analytics-screen">
      <header className="analytics-hero">
        <div className="analytics-hero-copy">
          <span className="section-kicker">JOURNEY INSIGHTS</span>
          <h1>{t("เรื่องราวการเดินทางของคุณ")}</h1>
          <p>{t("ทุกประเทศ ทุกทริป และทุกความทรงจำในภาพเดียว")}</p>
          <div>
            <b>{data.totals.trips}</b>
            <span>{t("ทริปที่ผ่านมา")}</span>
          </div>
        </div>
        <div className="analytics-hero-art" aria-hidden="true">
          <Cloud className="analytics-cloud analytics-cloud-one" />
          <Cloud className="analytics-cloud analytics-cloud-two" />
          <span className="analytics-sun" />
          <span className="analytics-flight-path" />
          <Plane className="analytics-plane" />
          <span className="analytics-land analytics-land-one" />
          <span className="analytics-land analytics-land-two" />
        </div>
      </header>

      {scopeFilter}

      <section className="analytics-kpis" aria-label={t("สถิติการเดินทาง")}>
        <article className="analytics-kpi">
          <span><CalendarDays size={17} /></span>
          <small>{t("ทริปที่ผ่านมา")}</small>
          <strong>{data.totals.trips}</strong>
        </article>
        <article className="analytics-kpi">
          <span><Globe2 size={17} /></span>
          <small>{t("ประเทศที่เคยไป")}</small>
          <strong>{data.totals.countries}</strong>
        </article>
        <article className="analytics-kpi analytics-kpi-wide">
          <span><ReceiptText size={17} /></span>
          <small>{t("ค่าใช้จ่ายเฉลี่ยต่อทริป")}</small>
          <strong>{money(data.totals.averageExpense)}</strong>
        </article>
      </section>

      <section className="card analytics-expense-card">
        <div className="analytics-section-head">
          <div>
            <h2>{t("ค่าใช้จ่ายเฉลี่ยต่อทริป")}</h2>
            <p>{t("ค่าใช้จ่ายทั้งหมด")}: {money(data.totals.expense)}</p>
          </div>
          <strong>{money(data.totals.averageExpense)}</strong>
        </div>
        <div className="analytics-expense-summary">
          <div
            className="analytics-expense-route"
            role="img"
            aria-label={`${t("ค่าใช้จ่ายทริปเฉลี่ย")} ${travelShare.toFixed(0)}%`}
          >
            <span style={{ width: `${travelShare}%` }}><Plane size={14} /></span>
            <span style={{ width: `${100 - travelShare}%` }}><Sparkles size={13} /></span>
          </div>
          <div className="analytics-expense-split">
            <div className="analytics-expense-kind is-travel">
              <i><Plane size={15} /></i>
              <span>
                <small>{t("ค่าใช้จ่ายทริปเฉลี่ย")}</small>
                <strong>{money(data.totals.averageTravelExpense)}</strong>
              </span>
              <b>{travelShare.toFixed(0)}%</b>
            </div>
            <div className="analytics-expense-kind is-shopping">
              <i><Sparkles size={15} /></i>
              <span>
                <small>{t("ค่า Shopping เฉลี่ย")}</small>
                <strong>{money(data.totals.averageShoppingExpense)}</strong>
              </span>
              <b>{(100 - travelShare).toFixed(0)}%</b>
            </div>
          </div>
        </div>
      </section>

      {flightInsights.totals.segments > 0 && <>
        <section className="card analytics-flight-overview">
          <div className="analytics-section-head">
            <div>
              <h2>{t("ข้อมูลการบิน")}</h2>
              <p>{t("สรุปจากเที่ยวบินของทริปที่ผ่านมาแล้ว")}</p>
            </div>
            <span className="analytics-flight-badge"><Plane size={18} /></span>
          </div>
          <div className="analytics-flight-kpis">
            <div><small>{t("ช่วงบินทั้งหมด")}</small><strong>{flightInsights.totals.segments}</strong><span>{flightInsights.totals.trips} {t("ทริป")}</span></div>
            <div><small>{t("ค่าตั๋วรวม")}</small><strong>{money(flightInsights.totals.ticketCostThb)}</strong><span>{t("เฉลี่ย")} {money(flightInsights.totals.averageTicketCostThb)}</span></div>
            <div><small>{t("เวลาบินเฉลี่ย")}</small><strong>{flightInsights.totals.averageDurationHours.toFixed(1)} ชม.</strong><span>{flightInsights.airlines.length} {t("สายการบิน")}</span></div>
          </div>
        </section>

        <section className="card analytics-airline-card">
          <div className="analytics-section-head">
            <div><h2>{t("สายการบินที่ใช้บ่อย")}</h2><p>{t("จำนวนช่วงบินและค่าตั๋วที่บันทึกไว้")}</p></div>
          </div>
          <div className="analytics-airline-list">
            {flightInsights.airlines.slice(0,6).map((item,index)=><div className="analytics-airline-row" key={item.code||item.name}>
              <b>{index+1}</b><div><strong>{item.name}</strong><small>{item.code}</small><span><i style={{width:`${item.flights/maxAirlineFlights*100}%`}}/></span></div><aside><strong>{item.flights} {t("เที่ยว")}</strong>{item.ticketCostThb>0&&<small>{money(item.ticketCostThb)}</small>}</aside>
            </div>)}
          </div>
        </section>

        <section className="analytics-flight-pattern-grid">
          <article className="card analytics-pattern-card">
            <div className="analytics-section-head"><div><h2>{t("ช่วงเวลาที่บินบ่อย")}</h2><p>{t("อิงเวลาออกเดินทาง")}</p></div></div>
            <div className="analytics-period-list">{flightInsights.periods.map(item=><div key={item.key}><span><strong>{t(item.label)}</strong><small>{item.flights} {t("เที่ยว")}</small></span><i><b style={{width:`${item.flights/maxPeriodFlights*100}%`}}/></i></div>)}</div>
          </article>
          <article className="card analytics-pattern-card">
            <div className="analytics-section-head"><div><h2>{t("ชั้นโดยสาร")}</h2><p>{t("ประเภทที่เลือกใช้")}</p></div></div>
            <div className="analytics-chip-cloud">{flightInsights.cabins.map(item=><span key={item.name}><Plane size={12}/><b>{item.name}</b><small>{item.flights}</small></span>)}</div>
            <div className="analytics-months"><small>{t("เดือนที่บินบ่อย")}</small><div>{flightInsights.months.slice(0,6).map(item=><span key={item.month}><b>{monthName(item.month)}</b><small>{item.flights} {t("เที่ยว")}</small></span>)}</div></div>
          </article>
        </section>

        <section className="card analytics-route-card">
          <div className="analytics-section-head"><div><h2>{t("เส้นทางที่บินบ่อย")}</h2><p>{t("ต้นทางและปลายทางจากทุกช่วงบิน")}</p></div></div>
          <div className="analytics-route-list">{flightInsights.routes.map((item,index)=><div key={item.route}><span>{index+1}</span><Plane size={15}/><strong>{item.route}</strong><small>{item.flights} {t("เที่ยว")}</small></div>)}</div>
        </section>
      </>}

      <section className="card analytics-chart-card">
        <div className="analytics-section-head">
          <div>
            <h2>{t("ทริปในแต่ละปี")}</h2>
            <p>{t("จำนวนทริปและค่าใช้จ่ายรวมในปีนั้น")}</p>
          </div>
        </div>
        <AnalyticsYearTrend years={data.years} money={money} tripLabel={t("ทริป")} />
      </section>

      <section className="card analytics-country-card">
        <div className="analytics-section-head">
          <div>
            <h2>{t("ประเทศและจำนวนครั้งที่ไป")}</h2>
            <p>{t("เรียงจากประเทศที่ไปบ่อยที่สุด")}</p>
          </div>
        </div>
        <div className="analytics-country-list">
          {data.countries.map((item) => (
            <div className="analytics-country-row" key={item.country}>
              <b className="analytics-country-flag">
                {countryByCode(item.countryCode)?.flag || "🌍"}
              </b>
              <div>
                <strong>{item.country}</strong>
                <span>
                  <i style={{ width: `${(item.trips / maxCountryTrips) * 100}%` }} />
                </span>
              </div>
              <small>
                <b>{item.trips} {t("ครั้ง")}</b>
                <span>{money(item.totalExpense)}</span>
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompactTripCard({
  trip,
  now,
  selectTrip,
  priority = false,
}: {
  trip: Trip;
  now: number;
  selectTrip: (trip: Trip) => void;
  priority?: boolean;
}) {
  const t = useT();
  const temporal = tripTemporalStatus(trip, now);
  const budget = Number(trip.budget_thb || 0);
  const actualSpent = Number(trip.actual_spent_thb || 0);
  const ongoing = temporal.ongoing;
  const past = temporal.past;
  const status = past
    ? t("ที่ผ่านมาแล้ว")
    : ongoing
      ? t("กำลังเดินทาง")
      : t(`กำลังจะมาถึงในอีก ${temporal.daysUntil} วัน`);
  return (
    <article
      className={`compact-trip-card ${ongoing ? "is-ongoing" : past ? "is-past" : "is-upcoming"} ${trip.members?.length ? "has-shared-members" : ""}`}
    >
      <button
        className="compact-trip-link"
        onClick={() => selectTrip(trip)}
        aria-label={`${t("ทริปทั้งหมด")} ${trip.name}`}
      />
      {!past && trip.has_incomplete_setup && (
        <i
          className="notification-dot compact-trip-notification-dot"
          aria-label={t("ข้อมูลทริปยังไม่ครบ")}
        />
      )}
      <div className="compact-trip-cover">
        <TripCoverImage
          src={trip.cover_image_url || DEFAULT_TRIP_COVER}
          alt={`รูปปก ${trip.name}`}
          sizes="(max-width: 600px) 42vw, 180px"
          priority={priority}
          className="compact-trip-cover-image"
        />
        {past && <TripRatingBadge trip={trip} variant="compact" />}
      </div>
      <div className="compact-trip-body">
        <span className="compact-trip-status">
          <span>{status}</span>
        </span>
        <h3>{trip.name}</h3>
        <p>
          <TripCountryFlag trip={trip} />
          <span>
            {formatTripDestination(
              trip.destination,
              trip.country_code,
              trip.country_name,
            )}
          </span>
        </p>
        <small>
          {tripRangeLabel(trip)} · ({t(`${trip.total_days} วัน`)})
        </small>
        <div className="compact-trip-meta">
          <span>{t("งบ")} ฿{budget.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
          <span className={actualSpent > budget && budget > 0 ? "is-over-budget" : "is-actual-spent"}>
            {t("ใช้จริง")} ฿{actualSpent.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <SharedTripAvatars members={trip.members} variant="compact" limit={3} />
    </article>
  );
}

function TripsDirectory({
  initialFilters,
  initialData,
  revision,
  selectTrip,
  createTrip,
  refreshEnabled,
}: {
  initialFilters: TripFilters;
  initialData?: { items: Trip[]; total: number; years: number[]; hasMore: boolean };
  revision: number;
  selectTrip: (trip: Trip) => void;
  createTrip: () => void;
  refreshEnabled: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const validStatus = (value: string): TripStatus =>
    ["ongoing", "upcoming", "past"].includes(value)
      ? (value as TripStatus)
      : "all";
  const validType = (value: string): TripType =>
    ["domestic", "international"].includes(value)
      ? (value as TripType)
      : "all";
  const [status, setStatus] = useState<TripStatus>(() =>
    validStatus(initialFilters.status),
  );
  const [tripType, setTripType] = useState<TripType>(() =>
    validType(initialFilters.type),
  );
  const [year, setYear] = useState(initialFilters.year || "all");
  const [queryText, setQueryText] = useState(initialFilters.q || "");
  const sort = "latest";
  const [items, setItems] = useState<Trip[]>(() =>
    applyCachedTripReviewSummaries(initialData?.items || []),
  );
  const [years, setYears] = useState<number[]>(initialData?.years || []);
  const [total, setTotal] = useState(initialData?.total || 0);
  const [hasMore, setHasMore] = useState(Boolean(initialData?.hasMore));
  const [loading, setLoading] = useState(!initialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [now] = useState(() => Date.now());
  const skipInitialFetch = useRef(Boolean(initialData));
  const hasContentRef = useRef(Boolean(initialData));
  const pullDistanceRef = useRef(0);
  const lastRestoreRefreshRef = useRef(0);
  useEffect(() => {
    const restoreLatestTrips = () => {
      if (tripListCache?.length) {
        const cachedById = new Map(
          tripListCache.map((trip) => [trip.id, trip]),
        );
        setItems((current) =>
          applyCachedTripReviewSummaries(
            current.map((trip) => cachedById.get(trip.id) || trip),
          ),
        );
      } else {
        setItems((current) => applyCachedTripReviewSummaries(current));
      }
      const now = Date.now();
      if (now - lastRestoreRefreshRef.current < 180) return;
      lastRestoreRefreshRef.current = now;
      setRefreshToken((value) => value + 1);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restoreLatestTrips();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", restoreLatestTrips);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", restoreLatestTrips);
    };
  }, []);
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        const showInitialLoading = !hasContentRef.current;
        if (showInitialLoading) setLoading(true);
        const params = new URLSearchParams({
          mode: "list",
          status,
          type: tripType,
          sort,
          limit: "20",
          offset: "0",
        });
        if (year !== "all") params.set("year", year);
        if (queryText.trim()) params.set("q", queryText.trim());
        const visibleParams = new URLSearchParams(params);
        visibleParams.delete("mode");
        visibleParams.delete("limit");
        visibleParams.delete("offset");
        if (status === "all") visibleParams.delete("status");
        if (tripType === "all") visibleParams.delete("type");
        if (sort === "latest") visibleParams.delete("sort");
        router.replace(
          visibleParams.size ? `/trips?${visibleParams}` : "/trips",
          { scroll: false },
        );
        try {
          const response = await fetch(`/api/trips?${params}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          const nextItems = applyCachedTripReviewSummaries(
            Array.isArray(data.items) ? data.items : [],
          );
          const nextIds = new Set(nextItems.map((trip) => trip.id));
          tripListCache = [
            ...nextItems,
            ...(tripListCache || []).filter((trip) => !nextIds.has(trip.id)),
          ];
          setItems(nextItems);
          setYears(Array.isArray(data.years) ? data.years : []);
          setTotal(Number(data.total || 0));
          setHasMore(Boolean(data.hasMore));
          hasContentRef.current = true;
        } catch (error) {
          if (
            (error as Error).name !== "AbortError" &&
            !hasContentRef.current
          ) {
            setItems([]);
            setTotal(0);
            setHasMore(false);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            setRefreshing(false);
            pullDistanceRef.current = 0;
            setPullDistance(0);
          }
        }
      },
      queryText === initialFilters.q ? 0 : 250,
    );
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    status,
    tripType,
    year,
    queryText,
    sort,
    revision,
    refreshToken,
    router,
    initialFilters.q,
  ]);
  useEffect(() => {
    if (!refreshEnabled || refreshing) return;
    let startY: number | null = null;
    let pulling = false;
    const updateDistance = (distance: number) => {
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      startY = event.touches[0].clientY;
      pulling = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pulling || startY === null || event.touches.length !== 1) return;
      if (window.scrollY > 0) {
        pulling = false;
        startY = null;
        updateDistance(0);
        return;
      }
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        updateDistance(0);
        return;
      }
      event.preventDefault();
      updateDistance(Math.min(92, delta * 0.44));
    };
    const onTouchEnd = () => {
      if (!pulling) return;
      pulling = false;
      startY = null;
      if (pullDistanceRef.current >= 68) {
        setRefreshing(true);
        updateDistance(54);
        setRefreshToken((value) => value + 1);
      } else updateDistance(0);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [refreshEnabled, refreshing]);
  async function loadMore() {
    setLoadingMore(true);
    const params = new URLSearchParams({
      mode: "list",
      status,
      type: tripType,
      sort,
      limit: "20",
      offset: String(items.length),
    });
    if (year !== "all") params.set("year", year);
    if (queryText.trim()) params.set("q", queryText.trim());
    try {
      const response = await fetch(`/api/trips?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) => [
        ...current,
        ...(Array.isArray(data.items) ? data.items : []),
      ]);
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }
  const statuses: Array<[TripStatus, string]> = [
    ["all", "ทั้งหมด"],
    ["ongoing", "กำลังเดินทาง"],
    ["upcoming", "กำลังจะมาถึง"],
    ["past", "ที่ผ่านมาแล้ว"],
  ];
  return (
    <>
      <div
        className={`pull-refresh-indicator ${refreshing ? "is-refreshing" : ""} ${pullDistance >= 68 ? "is-ready" : ""}`}
        style={{
          opacity: refreshing ? 1 : Math.min(1, pullDistance / 42),
          transform: `translate3d(-50%, ${Math.max(-48, pullDistance - 48)}px, 0)`,
        }}
        role="status"
        aria-live="polite"
      >
        <RefreshCw size={17} />
        <span>
          {t(
            refreshing
              ? "กำลังอัปเดต…"
              : pullDistance >= 68
                ? "ปล่อยเพื่อรีเฟรช"
                : "ดึงลงเพื่อรีเฟรช",
          )}
        </span>
      </div>
      <div
        className={`screen trips-directory dashboard-pull-content ${pullDistance > 0 && !refreshing ? "is-pulling" : ""}`}
        style={
          pullDistance > 0
            ? { transform: `translate3d(0, ${pullDistance}px, 0)` }
            : undefined
        }
      >
      <div className="directory-title">
        <div>
          <span className="section-kicker">TRIP LIBRARY</span>
          <h1>{t("ทริปทั้งหมด")}</h1>
          <p>{t(`${total} ทริป`)}</p>
        </div>
      </div>
      <div className="status-filter">
        {statuses.map(([value, label]) => (
          <button
            key={value}
            className={status === value ? "active" : ""}
            onClick={() => setStatus(value)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <section className="trip-filter-panel">
        <div className="filter-search-row">
          <label className="trip-search">
            <Search size={17} />
            <input
              type="search"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={t("ค้นหาทริป เมือง หรือประเทศ")}
              aria-label={t("ค้นหาทริป เมือง หรือประเทศ")}
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText("")}
                aria-label={t("ยกเลิก")}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <label className="trip-type-filter">
            <span className="sr-only">{t("ประเภททริป")}</span>
            <select
              value={tripType}
              onChange={(event) => setTripType(validType(event.target.value))}
              aria-label={t("ประเภททริป")}
            >
              <option value="all">{t("ทั้งหมด")}</option>
              <option value="domestic">{t("ในประเทศ")}</option>
              <option value="international">{t("ต่างประเทศ")}</option>
            </select>
          </label>
        </div>
        <div className="filter-bottom">
          <div className="year-filter">
            <button
              className={year === "all" ? "active" : ""}
              onClick={() => setYear("all")}
            >
              {t("ทุกปี")}
            </button>
            {years.map((value) => (
              <button
                key={value}
                className={year === String(value) ? "active" : ""}
                onClick={() => setYear(String(value))}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>
      {loading ? (
        <div className="directory-loading">{t("กำลังโหลดทริป…")}</div>
      ) : items.length ? (
        <>
          <div className="compact-trip-grid">
            {items.map((trip, index) => {
              const past = tripTemporalStatus(trip, now).past;
              const showPastDivider =
                status === "all" &&
                sort === "latest" &&
                past &&
                (index === 0 || !tripTemporalStatus(items[index - 1], now).past);
              return (
                <Fragment key={trip.id}>
                  {showPastDivider && (
                    <div className="trip-past-divider">
                      <span>{t("ที่ผ่านมาแล้ว")}</span>
                    </div>
                  )}
                  <CompactTripCard
                    trip={trip}
                    now={now}
                    priority={index < 3}
                    selectTrip={selectTrip}
                  />
                </Fragment>
              );
            })}
          </div>
          {hasMore && (
            <button
              className="load-more-btn"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {t(loadingMore ? "กำลังโหลดทริป…" : "โหลดเพิ่มเติม")}
            </button>
          )}
        </>
      ) : (
        <EmptyState
          icon={Search}
          title="ไม่พบทริปที่ตรงกับตัวกรอง"
          description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
          action="สร้างทริป"
          onClick={createTrip}
        />
      )}
      </div>
      <button
        className="directory-fab"
        onClick={createTrip}
        aria-label={t("สร้างทริปใหม่")}
      >
        <Plus size={22} />
        <span>{t("สร้างทริปใหม่")}</span>
      </button>
    </>
  );
}

function TripHeader({
  trip,
  back,
  actions,
  openReviews,
  manageMembers,
}: {
  trip: Trip;
  back: () => void;
  actions?: ReactNode;
  openReviews?: () => void;
  manageMembers?: () => void;
}) {
  const t = useT();
  const coverUrl = trip.cover_image_url || DEFAULT_TRIP_COVER;
  const ended = tripHasEnded(trip, new Date());
  return (
    <div className="trip-detail-head has-cover">
      <div className="trip-detail-image-frame">
        <TripCoverImage
          src={coverUrl}
          alt={`รูปปก ${trip.name}`}
          sizes="100vw"
          priority
          className="trip-detail-cover-image"
        />
      </div>
      <button
        className="back-btn trip-cover-back"
        onClick={back}
        aria-label={t("ย้อนกลับ")}
        title={t("ย้อนกลับ")}
      >
        <ChevronLeft size={19} />
      </button>
      {actions && <div className="trip-cover-actions">{actions}</div>}
      <div
        className={`trip-cover-copy ${trip.members?.length ? "has-collaborators" : ""}`}
      >
        {ended && <b className="trip-history-badge">{t("ที่ผ่านมาแล้ว")}</b>}
        <span className="eyebrow">
          <TripCountryFlag trip={trip} />
          {formatTripDestination(
            trip.destination,
            trip.country_code,
            trip.country_name,
          )}
        </span>
        <h1 className="page-title">{trip.name}</h1>
        <p className="page-sub">{tripHeaderRangeLabel(trip)}</p>
      </div>
      <SharedTripAvatars
        members={trip.members}
        variant="header"
        limit={3}
        onClick={manageMembers}
        actionLabel={
          trip.access_role !== "owner"
            ? t("ออกจากทริป")
            : t("จัดการผู้ร่วมทริป")
        }
      />
      {ended && (
        <TripRatingBadge
          trip={trip}
          variant="header"
          showEmpty
          onClick={openReviews}
        />
      )}
    </div>
  );
}

function TimelineCostBar({
  item,
  openCost,
}: {
  item: Itinerary;
  openCost: (item: Itinerary, index?: number) => void;
}) {
  const costs = item.cost_items || [];
  if (!costs.length) return null;
  return (
    <div className="inline-cost">
      <div className="timeline-cost-chips">
        {costs.map((cost, index) => (
          <button
            type="button"
            key={cost.id || `${cost.key}-${index}`}
            onClick={() => openCost(item, index)}
          >
            <span>{cost.key}</span>
            <b>{costSourceLabel(cost)}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransportModeIcon({ mode }: { mode: string }) {
  if (mode.includes("เดิน")) return <Footprints size={12} />;
  if (mode.includes("รถยนต์") || mode.includes("แท็กซี่"))
    return <CarFront size={12} />;
  if (mode.includes("รถบัส")) return <BusFront size={12} />;
  if (mode.includes("เครื่องบิน")) return <Plane size={12} />;
  if (mode.includes("เรือ")) return <Ship size={12} />;
  return <TrainFront size={12} />;
}

function TravelStayIcon({ size = 23 }: { size?: number }) {
  return (
    <svg
      className="travel-stay-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M2.1 7.9c.08-.58.63-.96 1.2-.83l5.5 1.25 4.72-5.15a3.25 3.25 0 0 1 3.78-.77l1.25.6-4.2 6.48 4.38 1.02-1.32 2.08-6.12-1.12-3.18 2.73-1.77-.48 1.48-3.5-4.93-1.15a1 1 0 0 1-.79-1.16Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 15h7v7H4v-7Zm2 1.7v1.35h1.35V16.7H6Zm2.7 0v1.35h1.35V16.7H8.7ZM6 19.4V22h4.05v-2.6H6ZM13 13.2h7v8.8h-7v-8.8Zm2 1.7v1.35h1.35V14.9H15Zm2.7 0v1.35h1.35V14.9H17.7ZM15 17.6v1.35h1.35V17.6H15Zm2.7 0v1.35h1.35V17.6H17.7ZM15 20.3V22h4.05v-1.7H15Z"
      />
    </svg>
  );
}

function useActiveDayScroll(day: number, tripId: string) {
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const strip = stripRef.current;
      const active = strip?.querySelector<HTMLElement>(`[data-day="${day}"]`);
      if (!strip || !active) return;
      const left =
        active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [day, tripId]);
  return stripRef;
}

function useItinerariesByDay(items: Itinerary[]) {
  return useMemo(() => {
    const grouped = new Map<number, Itinerary[]>();
    for (const item of items) {
      const dayItems = grouped.get(item.day_number);
      if (dayItems) dayItems.push(item);
      else grouped.set(item.day_number, [item]);
    }
    for (const dayItems of grouped.values())
      dayItems.sort((left, right) => {
        const accommodationOrder =
          Number(Boolean(left.accommodation_id)) -
          Number(Boolean(right.accommodation_id));
        if (accommodationOrder) return accommodationOrder;
        return (left.start_time || "99:99").localeCompare(
          right.start_time || "99:99",
        );
      });
    return grouped;
  }, [items]);
}

function TripTimelineSearch({
  trip,
  items,
  onSelect,
}: {
  trip: Trip;
  items: Itinerary[];
  onSelect: (item: Itinerary) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const keyword = deferredQuery.trim().toLocaleLowerCase();
  const searchIndex = useMemo(
    () =>
      items.map((item) => ({
        item,
        text: [
          item.place_name,
          item.address,
          item.transport_note,
          ...(item.cost_items || []).map((cost) => cost.key),
        ]
          .join(" ")
          .toLocaleLowerCase(),
      })),
    [items],
  );
  const results = useMemo(() => {
    if (!keyword) return EMPTY_ITINERARIES;
    const matches: Itinerary[] = [];
    for (const entry of searchIndex) {
      if (entry.text.includes(keyword)) matches.push(entry.item);
      if (matches.length === 12) break;
    }
    return matches;
  }, [keyword, searchIndex]);
  function choose(item: Itinerary) {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    onSelect(item);
    setQuery("");
    setOpen(false);
  }
  return (
    <div
      className="trip-timeline-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label>
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
          placeholder={t("ค้นหาสถานที่หรือรายการ")}
          aria-label={t("ค้นหาสถานที่หรือรายการ")}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label={t("ล้างการค้นหา")}
          >
            <X size={14} />
          </button>
        )}
      </label>
      {open && query.trim() && (
        <div className="trip-search-results" role="listbox">
          {results.map((item) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={item.id}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span>
                DAY {displayTripDay(trip, item.day_number)}
                <b>{item.start_time?.slice(0, 5) || "--:--"}</b>
              </span>
              <div>
                <strong>{item.place_name}</strong>
                <small>
                  {item.address ||
                    item.transport_note ||
                    t("ยังไม่ได้ระบุสถานที่")}
                </small>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
          {!results.length && <p>{t("ไม่พบสถานที่หรือรายการในทริปนี้")}</p>}
        </div>
      )}
    </div>
  );
}

function usePullToRefresh(enabled: boolean, onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    if (!enabled || refreshing) return;
    let startY: number | null = null;
    let pulling = false;
    const updateDistance = (distance: number) => {
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (
        event.touches.length !== 1 ||
        window.scrollY > 0 ||
        (event.target instanceof Element &&
          event.target.closest("input,textarea,select"))
      )
        return;
      startY = event.touches[0].clientY;
      pulling = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pulling || startY === null || event.touches.length !== 1) return;
      if (window.scrollY > 0) {
        pulling = false;
        startY = null;
        updateDistance(0);
        return;
      }
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        updateDistance(0);
        return;
      }
      event.preventDefault();
      updateDistance(Math.min(92, delta * 0.44));
    };
    const runRefresh = async () => {
      setRefreshing(true);
      updateDistance(54);
      try {
        await refreshRef.current();
      } finally {
        setRefreshing(false);
        updateDistance(0);
      }
    };
    const onTouchEnd = () => {
      if (!pulling) return;
      pulling = false;
      startY = null;
      if (pullDistanceRef.current >= 68) void runRefresh();
      else updateDistance(0);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, refreshing]);
  return { pullDistance, refreshing };
}

function PullRefreshIndicator({
  pullDistance,
  refreshing,
}: {
  pullDistance: number;
  refreshing: boolean;
}) {
  const t = useT();
  if (!pullDistance && !refreshing) return null;
  return (
    <div
      className={`pull-refresh-indicator ${refreshing ? "is-refreshing" : ""} ${pullDistance >= 68 ? "is-ready" : ""}`}
      style={{
        opacity: refreshing ? 1 : Math.min(1, pullDistance / 42),
        transform: `translate(-50%, ${Math.max(-46, pullDistance - 54)}px)`,
      }}
      aria-live="polite"
    >
      <RefreshCw size={16} />
      <span>
        {t(
          refreshing
            ? "กำลังรีเฟรช…"
            : pullDistance >= 68
              ? "ปล่อยเพื่อรีเฟรช"
              : "ดึงลงเพื่อรีเฟรช",
        )}
      </span>
    </div>
  );
}

function TripHub({
  trip,
  items,
  cards,
  day,
  setDay,
  back,
  editTrip,
  deleteTrip,
  openReviews,
  manageCollaborators,
  leaveTrip,
  addPlace,
  editPlace,
  duplicatePlace,
  openCost,
  onFlightChanged,
  notify,
  onRefresh,
  refreshEnabled,
  initialWorkspaceTab,
  initialView,
  initialAccommodationId,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  day: number;
  setDay: (day: number) => void;
  back: () => void;
  editTrip: () => void;
  deleteTrip: () => void;
  openReviews: () => void;
  manageCollaborators: () => void;
  leaveTrip: () => void;
  addPlace: (day: number) => void;
  editPlace: (item: Itinerary) => void;
  duplicatePlace: (item: Itinerary) => void;
  openCost: (item?: Itinerary, index?: number, defaultDay?: number) => void;
  onFlightChanged: () => void | Promise<void>;
  notify: (message: string) => void;
  onRefresh: () => Promise<void>;
  refreshEnabled: boolean;
  initialWorkspaceTab?: WorkspaceTab;
  initialView?: "plan" | "flights" | "stays";
  initialAccommodationId?: string;
}) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const [view, setView] = useState<"plan" | "expenses" | "workspace" | "flights" | "stays">(
    initialWorkspaceTab
      ? "workspace"
      : initialView === "stays" && trip.total_days <= 1
        ? trip.has_flights
          ? "flights"
          : "plan"
        : initialView || "plan",
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>(
    initialWorkspaceTab || "checklist",
  );
  const [completion, setCompletion] = useState({
    flightIncomplete: false,
    checklistIncomplete: false,
  });
  const [flightRefreshToken, setFlightRefreshToken] = useState(0);
  const [accommodationRefreshToken, setAccommodationRefreshToken] =
    useState(0);
  const [openAccommodationId, setOpenAccommodationId] = useState<string | null>(
    initialAccommodationId || null,
  );
  const [openAccommodationDay, setOpenAccommodationDay] = useState<
    number | null
  >(null);
  const now = useMinuteClock();
  const tripDay = tripDayAt(trip, now);
  const ended = tripHasEnded(trip, now);
  const hubRef = useRef<HTMLDivElement>(null);
  const pendingSearchTarget = useRef<string | null>(null);
  const searchHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const searchScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayStripRef = useActiveDayScroll(day, trip.id);
  const itinerariesByDay = useItinerariesByDay(items);
  const { pullDistance, refreshing } = usePullToRefresh(
    refreshEnabled &&
      (view === "plan" || view === "flights" || view === "stays"),
    async () => {
      try {
        await onRefresh();
        if (view === "flights") {
          invalidateClientResource(flightResourceKey(trip.id));
          setFlightRefreshToken((value) => value + 1);
        } else if (view === "stays") {
          invalidateClientResource(accommodationResourceKey(trip.id));
          setAccommodationRefreshToken((value) => value + 1);
        }
        window.dispatchEvent(
          new CustomEvent("trip-completion-changed", {
            detail: { tripId: trip.id },
          }),
        );
        notify(
          view === "flights"
            ? "อัปเดตข้อมูลเที่ยวบินแล้ว"
            : view === "stays"
              ? "อัปเดตข้อมูลที่พักแล้ว"
              : "อัปเดต Timeline แล้ว",
        );
      } catch {
        notify("รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    },
  );
  useEffect(() => {
    let active = true;
    async function loadCompletion() {
      try {
        const response = await fetch(`/api/trips/${trip.id}/completion`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (active && response.ok)
          setCompletion({
            flightIncomplete: Boolean(body.flightIncomplete),
            checklistIncomplete: Boolean(body.checklistIncomplete),
          });
      } catch {
        // The dots are a convenience indicator; the screens remain usable offline.
      }
    }
    const handleChanged = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail
        ?.tripId;
      if (!changedTripId || changedTripId === trip.id) void loadCompletion();
    };
    void loadCompletion();
    window.addEventListener("trip-completion-changed", handleChanged);
    return () => {
      active = false;
      window.removeEventListener("trip-completion-changed", handleChanged);
    };
  }, [trip.id, trip.has_flights]);
  function selectView(
    nextView: "plan" | "expenses" | "workspace" | "flights" | "stays",
    nextWorkspaceTab = activeWorkspaceTab,
  ) {
    setView(nextView);
    if (nextView === "workspace") setActiveWorkspaceTab(nextWorkspaceTab);
    const url = new URL(window.location.href);
    if (nextView === "workspace")
      url.searchParams.set("workspace", nextWorkspaceTab);
    else url.searchParams.delete("workspace");
    if (nextView === "flights" || nextView === "stays") url.searchParams.set("view", nextView);
    else url.searchParams.delete("view");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  useEffect(() => {
    const handleFlightsDisabled = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail
        ?.tripId;
      if (changedTripId !== trip.id) return;
      setView("plan");
      const url = new URL(window.location.href);
      url.searchParams.delete("workspace");
      url.searchParams.delete("view");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    };
    window.addEventListener("trip-flights-disabled", handleFlightsDisabled);
    return () =>
      window.removeEventListener("trip-flights-disabled", handleFlightsDisabled);
  }, [trip.id]);
  useEffect(
    () =>
      setDay(
        ended
          ? 1
          : tripDay !== null && tripDay >= 1
            ? Math.min(tripDay, trip.total_days)
            : 1,
      ),
    [trip.id, trip.total_days, tripDay, ended, setDay],
  );
  const baseDate = localDate(trip.outbound_departure_at, trip.start_date);
  const activeDateLabel = tripDayLabel(baseDate, day);
  const dayItems = itinerariesByDay.get(day) || EMPTY_ITINERARIES;
  const slots = {
    morning: t("เช้า"),
    afternoon: t("บ่าย"),
    evening: t("เย็น"),
  };
  const nowMinutes = zonedClock(now, trip.timezone).minutes;
  const currentIndex =
    tripDay === day
      ? dayItems.reduce((found, item, index) => {
          const start = timeInMinutes(
            item.start_time || (item.accommodation_id ? "23:30" : null),
          );
          return start !== null && start <= nowMinutes ? index : found;
        }, -1)
      : -1;
  function revealSearchTarget(id: string) {
    const frame = requestAnimationFrame(() => {
      const target = hubRef.current?.querySelector<HTMLElement>(
        `[data-itinerary-id="${id}"]`,
      );
      if (!target) return;
      pendingSearchTarget.current = null;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("search-reveal");
      if (searchScrollTimer.current) clearTimeout(searchScrollTimer.current);
      searchScrollTimer.current = setTimeout(() => {
        hubRef.current
          ?.querySelector<HTMLElement>(`[data-itinerary-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 360);
      if (searchHighlightTimer.current)
        clearTimeout(searchHighlightTimer.current);
      searchHighlightTimer.current = setTimeout(
        () => target.classList.remove("search-reveal"),
        1800,
      );
    });
    return frame;
  }
  function selectSearchResult(item: Itinerary) {
    pendingSearchTarget.current = item.id;
    if (item.day_number === day) revealSearchTarget(item.id);
    else startTransition(() => setDay(item.day_number));
  }
  useEffect(() => {
    const targetId = pendingSearchTarget.current;
    if (!targetId) return;
    const frame = revealSearchTarget(targetId);
    return () => cancelAnimationFrame(frame);
  }, [day]);
  useEffect(
    () => () => {
      if (searchHighlightTimer.current)
        clearTimeout(searchHighlightTimer.current);
      if (searchScrollTimer.current) clearTimeout(searchScrollTimer.current);
    },
    [],
  );
  return (
    <>
      <PullRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div ref={hubRef} className="screen trip-hub-screen">
      <div className="trip-cover-region">
        <TripHeader
          trip={trip}
          back={back}
          openReviews={openReviews}
          manageMembers={
            trip.access_role !== "owner"
              ? leaveTrip
              : manageCollaborators
          }
          actions={
            <>
              {trip.google_photos_url && (
                <a
                  href={trip.google_photos_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("เปิด Google Photos")}
                  title={t("เปิด Google Photos")}
                >
                  <Images size={18} />
                  <span>{t("เปิด Google Photos")}</span>
                </a>
              )}
              {(trip.has_flights || trip.total_days > 1) && <button
                className={
                  view !== "flights" &&
                  view !== "stays" &&
                  trip.has_flights &&
                  completion.flightIncomplete
                    ? "has-notification-dot"
                    : ""
                }
                type="button"
                onClick={() =>
                  selectView(
                    view === "flights" || view === "stays"
                      ? "plan"
                      : trip.has_flights
                        ? "flights"
                        : "stays",
                  )
                }
                aria-label={t(
                  view === "flights" || view === "stays"
                    ? "แพลน"
                    : trip.has_flights && trip.total_days > 1
                      ? "เที่ยวบินและที่พัก"
                      : trip.has_flights
                        ? "เที่ยวบิน"
                        : "ที่พัก",
                )}
              >
                {view === "flights" || view === "stays" ? (
                  <Navigation size={18} />
                ) : trip.has_flights && trip.total_days > 1 ? (
                  <TravelStayIcon />
                ) : trip.has_flights ? (
                  <Plane size={18} />
                ) : (
                  <BedDouble size={18} />
                )}
                <span>
                  {t(
                    view === "flights" || view === "stays"
                      ? "แพลน"
                      : trip.has_flights && trip.total_days > 1
                        ? "เที่ยวบินและที่พัก"
                        : trip.has_flights
                          ? "เที่ยวบิน"
                          : "ที่พัก",
                  )}
                </span>
                {view !== "flights" &&
                  view !== "stays" &&
                  trip.has_flights &&
                  completion.flightIncomplete && (
                    <i
                      className="notification-dot"
                      aria-label={t(
                        trip.country_code === "TH"
                          ? "ข้อมูลเที่ยวบินยังไม่ครบ"
                          : "ข้อมูลเที่ยวบินหรือประกันเดินทางยังไม่ครบ",
                      )}
                    />
                  )}
              </button>}
              <button
                className={completion.checklistIncomplete ? "has-notification-dot" : ""}
                type="button"
                onClick={() =>
                  selectView(view === "workspace" ? "plan" : "workspace")
                }
              >
                {view === "workspace" ? (
                  <Navigation size={18} />
                ) : (
                  <FolderOpen size={18} />
                )}
                <span>{t(view === "workspace" ? "แพลน" : "เตรียมทริป")}</span>
                {completion.checklistIncomplete && <i className="notification-dot" aria-label={t("Checklist ยังไม่ครบ 100%")} />}
              </button>
              <button
                type="button"
                onClick={() =>
                  selectView(view === "expenses" ? "plan" : "expenses")
                }
              >
                {view === "expenses" ? (
                  <Navigation size={18} />
                ) : (
                  <ReceiptText size={18} />
                )}
                <span>{t(view === "expenses" ? "แพลน" : "ค่าใช้จ่าย")}</span>
              </button>
              <button type="button" onClick={editTrip}>
                <Pencil size={18} />
                <span>{t("แก้ไข")}</span>
              </button>
              {trip.access_role === "owner" && (
                <button type="button" onClick={deleteTrip}>
                  <Trash2 size={18} />
                  <span>{t("ลบทริป")}</span>
                </button>
              )}
            </>
          }
        />
      </div>
      <div className="trip-hub-body">
        {view === "plan" ? (
          <>
            {trip.total_days > 1 && (
              <div
                ref={dayStripRef}
                className={`day-strip plan-day-strip ${trip.total_days < 6 ? "is-short" : ""}`}
              >
                {Array.from(
                  { length: trip.total_days },
                  (_, index) => index + 1,
                ).map((number) => {
                  const date = new Date(`${baseDate}T00:00:00`);
                  date.setDate(date.getDate() + number - 1);
                  const isToday = tripDay === number;
                  const isPast = tripDay !== null && tripDay > number;
                  return (
                    <button
                      key={number}
                      data-day={number}
                      className={`day-pill ${day === number ? "active" : ""} ${isToday ? "today" : ""} ${isPast ? "past-day" : ""}`}
                      onClick={() => startTransition(() => setDay(number))}
                    >
                      <small>DAY</small>
                      <strong>{displayTripDay(trip, number)}</strong>
                      <small>
                        {isToday
                          ? t("วันนี้")
                          : date.toLocaleDateString(
                              lang === "EN" ? "en-US" : "th-TH",
                              { weekday: "short" },
                            )}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="section-head timeline-heading timeline-heading-search">
              <div>
                <h2>{t(`แผนวันที่ ${displayTripDay(trip, day)}`)}</h2>
                <p>
                  {activeDateLabel} ·{" "}
                  {tripDay === day
                    ? `${t("เวลาปัจจุบัน")} ${now.toLocaleTimeString(lang === "EN" ? "en-GB" : "th-TH", { hour: "2-digit", minute: "2-digit", timeZone: trip.timezone || "Asia/Bangkok" })} · `
                    : ""}
                  {t(`${dayItems.length} สถานที่`)}
                </p>
              </div>
              <TripTimelineSearch
                trip={trip}
                items={items}
                onSelect={selectSearchResult}
              />
              <button
                className="directory-fab timeline-fab"
                onClick={() => addPlace(day)}
                aria-label={t(`เพิ่มรายการวันที่ ${displayTripDay(trip, day)}`)}
              >
                <Plus size={22} />
                <span>{t("เพิ่มสถานที่")}</span>
              </button>
            </div>
            {dayItems.length === 0 ? (
              <EmptyState
                title={t(`Day ${displayTripDay(trip, day)} ยังว่างอยู่`)}
                description={t(
                  "เพิ่มสถานที่และเวลา รายการใหม่จะถูกเรียงใน Timeline อัตโนมัติ",
                )}
                action={t("เพิ่มสถานที่")}
                onClick={() => addPlace(day)}
              />
            ) : (
              <div className="timeline editable-timeline">
                {dayItems.map((item, index) => {
                  const isCurrent = index === currentIndex;
                  const isPast =
                    tripDay !== null &&
                    (tripDay > day ||
                      (tripDay === day &&
                        currentIndex >= 0 &&
                        index < currentIndex));
                  const previous = index > 0 ? dayItems[index - 1] : null;
                  const origin =
                    previous?.address || previous?.place_name || "";
                  const destination = item.address || item.place_name;
                  const mode = item.transport_mode?.includes("เดิน")
                    ? "walking"
                    : item.transport_mode?.includes("รถยนต์") ||
                        item.transport_mode?.includes("แท็กซี่")
                      ? "driving"
                      : "transit";
                  const mapsUrl = previous
                    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`
                    : "";
                  const currentLocationMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
                  return (
                    <div
                      data-itinerary-id={item.id}
                      className={`timeline-stop ${item.accommodation_id ? "accommodation-stop" : ""} ${isCurrent ? "current-stop" : ""} ${isPast ? "past-stop" : ""}`}
                      key={item.id}
                    >
                      {index > 0 && item.transport_mode && (
                        <div className="transport transport-to-stop">
                          <TransportModeIcon mode={item.transport_mode} />
                          <span>{t(item.transport_mode)}</span>
                        </div>
                      )}
                      <div className="event">
                        <div className="event-dot">
                          {item.accommodation_id ? <BedDouble size={16} /> : <MapPin size={16} />}
                        </div>
                        <article
                          className="event-card editable-event-card"
                          onClick={(event) => {
                            if (
                              !(event.target as HTMLElement).closest("button,a")
                            ) {
                              if (item.accommodation_id) {
                                setOpenAccommodationDay(item.day_number);
                                setOpenAccommodationId(item.accommodation_id);
                              }
                              else editPlace(item);
                            }
                          }}
                        >
                          <button
                            className="event-card-main"
                            onClick={() => {
                              if (item.accommodation_id) {
                                setOpenAccommodationDay(item.day_number);
                                setOpenAccommodationId(item.accommodation_id);
                              } else editPlace(item);
                            }}
                          >
                            <div className="event-copy">
                              <span className="event-time">
                                {item.accommodation_id
                                  ? "23:30"
                                  : item.start_time?.slice(0, 5) ||
                                    t("ไม่ระบุเวลา")}{" "}
                                · {slots[item.time_slot]}
                                {item.accommodation_id && (
                                  <>
                                    {" "}
                                    · พักที่นี่ คืนที่{" "}
                                    {item.accommodation_night}/
                                    {item.accommodation_nights}
                                  </>
                                )}
                              </span>
                              <div className="timeline-title-row">
                                <h3>{item.place_name}</h3>
                              </div>
                              <p>
                                <MapPin size={10} />
                                {item.address || t("ยังไม่ได้ระบุสถานที่")}
                              </p>
                              {item.accommodation_id && (
                                <>
                                  {item.transport_note &&
                                    !item.transport_note.startsWith(
                                      "พักที่นี่ · คืนที่",
                                    ) && (
                                      <p className="event-detail">
                                        {item.transport_note}
                                      </p>
                                    )}
                                </>
                              )}
                              {!item.accommodation_id && item.transport_note && (
                                <p className="event-detail">
                                  {item.transport_note}
                                </p>
                              )}
                            </div>
                            <span className="event-edit">
                              <Pencil size={14} />
                            </span>
                          </button>
                          <TimelineCostBar item={item} openCost={openCost} />
                          <div className="navigate-actions">
                            {previous && (
                              <a
                                className="navigate-point-btn"
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${t("นำทางจาก")} ${previous.place_name} ${t("ไปยัง")} ${item.place_name}`}
                                title={t("นำทางจากจุดก่อนหน้า")}
                              >
                                <Navigation size={17} />
                              </a>
                            )}
                            <a
                              className="navigate-point-btn navigate-current-btn"
                              href={currentLocationMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${t("นำทางจากที่อยู่ปัจจุบัน")} ${t("ไปยัง")} ${item.place_name}`}
                              title={t("นำทางจากที่อยู่ปัจจุบัน")}
                            >
                              <LocateFixed size={17} />
                            </a>
                            {!item.accommodation_id && <button
                              type="button"
                              className="navigate-point-btn"
                              onClick={() => duplicatePlace(item)}
                              aria-label={t("ทำสำเนาแผน")}
                              title={t("ทำสำเนาแผน")}
                            >
                              <Copy size={16} />
                            </button>}
                            <button
                              type="button"
                              className="navigate-point-btn expense-point-btn"
                              onClick={() => openCost(item)}
                              aria-label={t("กรอกเงิน")}
                              title={t("กรอกเงิน")}
                            >
                              <ReceiptText size={16} />
                            </button>
                          </div>
                        </article>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : view === "flights" || view === "stays" ? (
          <div className="travel-stay-section">
            {trip.has_flights && trip.total_days > 1 && <nav className="travel-stay-tabs" aria-label={t("เที่ยวบินและที่พัก")}><button type="button" className={view==="flights"?"active":""} onClick={()=>selectView("flights")}><Plane size={17}/><span>{t("เที่ยวบิน")}</span>{completion.flightIncomplete&&<i className="notification-dot"/>}</button><button type="button" className={view==="stays"?"active":""} onClick={()=>selectView("stays")}><BedDouble size={17}/><span>{t("ที่พัก")}</span></button></nav>}
            {view === "flights" && trip.has_flights ? <TripFlights
              tripId={trip.id}
              members={trip.members || []}
              tripOutboundAt={trip.outbound_departure_at}
              tripReturnAt={trip.return_departure_at}
              showTravelInsurance={trip.country_code !== "TH"}
              canDelete={trip.access_role !== "view"}
              notify={notify}
              onChanged={onFlightChanged}
              refreshToken={flightRefreshToken}
              onOpenDocuments={() => selectView("workspace", "documents")}
            /> : <TripAccommodations
              tripId={trip.id}
              totalDays={trip.total_days}
              hasDayZero={trip.has_day_zero}
              startDate={baseDate}
              members={trip.members || []}
              cards={cards}
              locations={items.flatMap((item) =>
                item.address
                  ? [{ name: item.place_name, address: item.address }]
                  : [],
              )}
              openAccommodationId={openAccommodationId}
              openAccommodationDay={openAccommodationDay}
              onAccommodationOpened={() => {
                setOpenAccommodationId(null);
                setOpenAccommodationDay(null);
                const url = new URL(window.location.href);
                url.searchParams.delete("accommodation");
                window.history.replaceState(
                  window.history.state,
                  "",
                  `${url.pathname}${url.search}${url.hash}`,
                );
              }}
              refreshToken={accommodationRefreshToken}
              canDelete={trip.access_role !== "view"}
              notify={notify}
              onChanged={onFlightChanged}
            />}
          </div>
        ) : view === "expenses" ? (
          <PlanExpensesContent
            trip={trip}
            items={items}
            cards={cards}
            openCost={openCost}
          />
        ) : (
          <TripWorkspace
            tripId={trip.id}
            onUndo={() => location.reload()}
            label={t}
            initialTab={activeWorkspaceTab}
          />
        )}
        {view === "plan" && trip.total_days > 1 && (
          <TripAccommodations
            tripId={trip.id}
            totalDays={trip.total_days}
            hasDayZero={trip.has_day_zero}
            startDate={baseDate}
            members={trip.members || []}
            cards={cards}
            locations={items.flatMap((item) =>
              item.address
                ? [{ name: item.place_name, address: item.address }]
                : [],
            )}
            openAccommodationId={openAccommodationId}
            openAccommodationDay={openAccommodationDay}
            onAccommodationOpened={() => {
              setOpenAccommodationId(null);
              setOpenAccommodationDay(null);
            }}
            overlayOnly
            refreshToken={accommodationRefreshToken}
            canDelete={trip.access_role !== "view"}
            notify={notify}
            onChanged={onFlightChanged}
          />
        )}
      </div>
      </div>
    </>
  );
}

function TimelineScreen({
  trip,
  items,
  cards,
  day,
  setDay,
  addPlace,
  back,
  onRefresh,
  refreshEnabled,
  notify,
  onChanged,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  day: number;
  setDay: (n: number) => void;
  addPlace: () => void;
  back: () => void;
  onRefresh: () => Promise<void>;
  refreshEnabled: boolean;
  notify: (message: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const now = useMinuteClock();
  const tripDay = tripDayAt(trip, now);
  const ended = tripHasEnded(trip, now);
  const dayStripRef = useActiveDayScroll(day, trip.id);
  const itinerariesByDay = useItinerariesByDay(items);
  const [openAccommodationId, setOpenAccommodationId] = useState<string | null>(null);
  const [openAccommodationDay, setOpenAccommodationDay] = useState<number | null>(null);
  const { pullDistance, refreshing } = usePullToRefresh(
    refreshEnabled,
    async () => {
      try {
        await onRefresh();
        notify("อัปเดต Timeline แล้ว");
      } catch {
        notify("รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    },
  );
  useEffect(
    () =>
      setDay(
        ended
          ? 1
          : tripDay !== null && tripDay >= 1
            ? Math.min(tripDay, trip.total_days)
            : 1,
      ),
    [trip.id, trip.total_days, tripDay, ended, setDay],
  );
  const dayItems = itinerariesByDay.get(day) || EMPTY_ITINERARIES;
  const slots = {
    morning: t("เช้า"),
    afternoon: t("บ่าย"),
    evening: t("เย็น"),
  };
  const baseDate = localDate(trip.outbound_departure_at, trip.start_date);
  const activeDateLabel = tripDayLabel(baseDate, day);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentIndex =
    tripDay === day
      ? dayItems.reduce((found, item, index) => {
          const start = timeInMinutes(
            item.start_time || (item.accommodation_id ? "23:30" : null),
          );
          return start !== null && start <= nowMinutes ? index : found;
        }, -1)
      : -1;
  return (
    <>
      <PullRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="screen timeline-screen">
      <TripHeader trip={trip} back={back} />
      <div
        ref={dayStripRef}
        className={`day-strip plan-day-strip ${trip.total_days < 6 ? "is-short" : ""}`}
      >
        {Array.from({ length: trip.total_days }, (_, i) => i + 1).map((n) => {
          const date = new Date(`${baseDate}T00:00:00`);
          date.setDate(date.getDate() + n - 1);
          const isToday = tripDay === n;
          const isPast = tripDay !== null && tripDay > n;
          return (
            <button
              key={n}
              data-day={n}
              className={`day-pill ${day === n ? "active" : ""} ${isToday ? "today" : ""} ${isPast ? "past-day" : ""}`}
              onClick={() => startTransition(() => setDay(n))}
            >
              <small>DAY</small>
              <strong>{displayTripDay(trip, n)}</strong>
              <small>
                {isToday
                  ? t("วันนี้")
                  : date.toLocaleDateString(lang === "EN" ? "en-US" : "th-TH", {
                      weekday: "short",
                    })}
              </small>
            </button>
          );
        })}
      </div>
      <div className="section-head">
        <div>
          <h2>{t(`แผนวันที่ ${displayTripDay(trip, day)}`)}</h2>
          <p>
            {activeDateLabel} ·{" "}
            {tripDay === day
              ? `${t("เวลาปัจจุบัน")} ${now.toLocaleTimeString(lang === "EN" ? "en-GB" : "th-TH", { hour: "2-digit", minute: "2-digit" })} · `
              : ""}
            {t(`${dayItems.length} สถานที่`)}
          </p>
        </div>
        <button
          className="directory-fab timeline-fab"
          onClick={addPlace}
          aria-label={t("เพิ่มสถานที่")}
        >
          <Plus size={22} />
          <span>{t("เพิ่มสถานที่")}</span>
        </button>
      </div>
      {dayItems.length === 0 ? (
        <EmptyState
          title={t(`Day ${displayTripDay(trip, day)} ยังว่างอยู่`)}
          description={t("เพิ่มสถานที่ เวลา และวิธีเดินทางสำหรับวันนี้")}
          action={t("เพิ่มสถานที่")}
          onClick={addPlace}
        />
      ) : (
        <div className="timeline">
          {dayItems.map((item, index) => {
            const isCurrent = index === currentIndex;
            const isPast =
              tripDay !== null &&
              (tripDay > day ||
                (tripDay === day && currentIndex >= 0 && index < currentIndex));
            return (
              <div
                className={`timeline-stop ${item.accommodation_id ? "accommodation-stop" : ""} ${isCurrent ? "current-stop" : ""} ${isPast ? "past-stop" : ""}`}
                key={item.id}
              >
                {index > 0 && item.transport_mode && (
                  <div className="transport transport-to-stop">
                    <TransportModeIcon mode={item.transport_mode} />
                    {t(item.transport_mode)}
                  </div>
                )}
                <div className="event">
                  <div className="event-dot">
                    {item.accommodation_id ? <BedDouble size={16} /> : <MapPin size={16} />}
                  </div>
                  <article
                    className="event-card"
                    onClick={() => {
                      if (item.accommodation_id) {
                        setOpenAccommodationDay(item.day_number);
                        setOpenAccommodationId(item.accommodation_id);
                      }
                    }}
                  >
                    <div className="event-copy">
                      <span className="event-time">
                        {item.accommodation_id
                          ? "23:30"
                          : item.start_time?.slice(0, 5) ||
                            t("ไม่ระบุเวลา")}{" "}
                        · {slots[item.time_slot]}
                        {item.accommodation_id && (
                          <>
                            {" "}
                            · พักที่นี่ คืนที่ {item.accommodation_night}/
                            {item.accommodation_nights}
                          </>
                        )}
                      </span>
                      <div className="timeline-title-row">
                        <h3>{item.place_name}</h3>
                      </div>
                      <p>
                        <MapPin size={10} />
                        {item.address || t("ยังไม่ได้ระบุที่อยู่")}
                      </p>
                      {item.accommodation_id && (
                        <>
                          {item.transport_note &&
                            !item.transport_note.startsWith(
                              "พักที่นี่ · คืนที่",
                            ) && (
                              <p className="event-detail">
                                {item.transport_note}
                              </p>
                            )}
                        </>
                      )}
                      {!item.accommodation_id && item.transport_note && (
                        <p className="event-detail">{item.transport_note}</p>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {trip.total_days > 1 && (
        <TripAccommodations
          tripId={trip.id}
          totalDays={trip.total_days}
          hasDayZero={trip.has_day_zero}
          startDate={baseDate}
          members={trip.members || []}
          cards={cards}
          locations={items.flatMap((item) =>
            item.address
              ? [{ name: item.place_name, address: item.address }]
              : [],
          )}
          openAccommodationId={openAccommodationId}
          openAccommodationDay={openAccommodationDay}
          onAccommodationOpened={() => {
            setOpenAccommodationId(null);
            setOpenAccommodationDay(null);
          }}
          overlayOnly
          canDelete={trip.access_role !== "view"}
          notify={notify}
          onChanged={onChanged}
        />
      )}
      </div>
    </>
  );
}

function CategoryDonut({
  categories,
  total,
}: {
  categories: Array<[string, number]>;
  total: number;
}) {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState<number | null>(
    categories.length ? 0 : null,
  );
  const colors = [
    "#ff4f0a",
    "#ff9f2d",
    "#ffcc4d",
    "#34c759",
    "#0a84ff",
    "#8e5cff",
    "#ff5c8a",
  ];
  const segments = categories.reduce(
    (result, [category, amount], index) => {
      const percent = total ? (amount / total) * 100 : 0;
      return {
        cursor: result.cursor + percent,
        items: [
          ...result.items,
          {
            category,
            amount,
            index,
            percent,
            offset: result.cursor,
            color: colors[index % colors.length],
          },
        ],
      };
    },
    {
      cursor: 0,
      items: [] as Array<{
        category: string;
        amount: number;
        index: number;
        percent: number;
        offset: number;
        color: string;
      }>,
    },
  ).items;
  const selectedIndex = segments.length
    ? Math.min(activeIndex ?? 0, segments.length - 1)
    : null;
  const active =
    selectedIndex === null ? null : segments[selectedIndex] || null;
  const money = (amount: number) => bahtFormat(amount);
  return (
    <section className="budget-donut-summary">
      <div className="expense-total-banner">
        <span>{t("รวมค่าใช้จ่าย")}</span>
        <strong>฿{money(total)}</strong>
        <small>{t("สัดส่วนค่าใช้จ่ายตามประเภท")}</small>
      </div>
      <div className="donut-layout">
        <div className="donut-stage">
          <svg
            className="interactive-donut"
            viewBox="0 0 160 160"
            role="group"
            aria-label={t("สัดส่วนค่าใช้จ่ายตามประเภท")}
          >
            <circle
              className="donut-track"
              cx="80"
              cy="80"
              r="54"
              pathLength="100"
            />
            {segments.map((segment) => (
              <circle
                key={segment.category}
                className={`donut-segment ${selectedIndex === segment.index ? "active" : ""}`}
                cx="80"
                cy="80"
                r="54"
                pathLength="100"
                fill="none"
                stroke={segment.color}
                strokeWidth="28"
                strokeDasharray={`${segment.percent} ${100 - segment.percent}`}
                strokeDashoffset={-segment.offset}
                transform="rotate(-90 80 80)"
                role="button"
                tabIndex={0}
                aria-label={`${t(segment.category)} ฿${money(segment.amount)} ${segment.percent.toFixed(1)}%`}
                aria-pressed={selectedIndex === segment.index}
                onMouseEnter={() => setActiveIndex(segment.index)}
                onFocus={() => setActiveIndex(segment.index)}
                onClick={() => setActiveIndex(segment.index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveIndex(segment.index);
                  }
                }}
              >
                <title>
                  {t(segment.category)} · ฿{money(segment.amount)} ·{" "}
                  {segment.percent.toFixed(1)}%
                </title>
              </circle>
            ))}
          </svg>
          <div className="donut-tooltip" role="status" aria-live="polite">
            {active ? (
              <>
                <i style={{ background: active.color }} />
                <span>{t(active.category)}</span>
                <strong>฿{money(active.amount)}</strong>
                <small>{active.percent.toFixed(1)}%</small>
              </>
            ) : (
              <>
                <span>{t("ยังไม่มีค่าใช้จ่าย")}</span>
                <strong>฿0.00</strong>
              </>
            )}
          </div>
        </div>
        <div className="donut-legend">
          {segments.length ? (
            segments.map((segment) => (
              <button
                type="button"
                key={segment.category}
                className={selectedIndex === segment.index ? "active" : ""}
                onMouseEnter={() => setActiveIndex(segment.index)}
                onFocus={() => setActiveIndex(segment.index)}
                onClick={() => setActiveIndex(segment.index)}
                aria-pressed={selectedIndex === segment.index}
              >
                <i style={{ background: segment.color }} />
                <span>
                  <b>{t(segment.category)}</b>
                  <small>{segment.percent.toFixed(1)}%</small>
                </span>
                <strong>฿{money(segment.amount)}</strong>
              </button>
            ))
          ) : (
            <div className="donut-empty">
              <span>{t("ยังไม่มีค่าใช้จ่าย")}</span>
              <strong>฿0.00</strong>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function LegacyPlanExpensesContent({
  trip,
  items,
  openCost,
}: {
  trip: Trip;
  items: Itinerary[];
  openCost: (item?: Itinerary, index?: number, defaultDay?: number) => void;
}) {
  const t = useT();
  const total = items.reduce(
    (sum, item) =>
      sum +
      (item.cost_items || []).reduce(
        (costSum, cost) => costSum + Number(cost.value || 0),
        0,
      ),
    0,
  );
  const categories = Array.from(
    items
      .flatMap((item) => item.cost_items || [])
      .reduce(
        (map, cost) =>
          map.set(
            cost.category || "อื่น ๆ",
            (map.get(cost.category || "อื่น ๆ") || 0) + Number(cost.value || 0),
          ),
        new Map<string, number>(),
      ),
  ).sort((a, b) => b[1] - a[1]);
  const availableDays = Array.from(
    new Set(items.map((item) => item.day_number)),
  ).sort((a, b) => a - b);
  const firstAvailableDay = availableDays[0];
  return (
    <div className="plan-expenses">
      <div className="toolbar expense-toolbar">
        <div>
          <h2 style={{ margin: 0, fontWeight: 500 }}>
            {t("สรุปค่าใช้จ่ายจากแพลน")}
          </h2>
          <p className="page-sub" style={{ margin: 0 }}>
            {t("ยอดรวมแปลงเป็นเงินบาทด้วยเรตของวันที่บันทึก")}
          </p>
        </div>
        <button
          type="button"
          className="primary-btn expense-add-btn"
          disabled={!firstAvailableDay}
          title={t(
            firstAvailableDay ? "เพิ่มค่าใช้จ่าย" : "ต้องเพิ่ม Timeline ก่อน",
          )}
          onClick={() =>
            firstAvailableDay &&
            openCost(undefined, undefined, firstAvailableDay)
          }
        >
          <Plus size={15} />
          {t("เพิ่มค่าใช้จ่าย")}
        </button>
      </div>
      <CategoryDonut categories={categories} total={total} />
      <div className="expense-days">
        {Array.from({ length: trip.total_days }, (_, index) => index + 1).map(
          (dayNumber) => {
            const dayItems = items
              .filter((item) => item.day_number === dayNumber)
              .sort((a, b) =>
                (a.start_time || "99:99").localeCompare(
                  b.start_time || "99:99",
                ),
              );
            const dayTotal = dayItems.reduce(
              (sum, item) =>
                sum +
                (item.cost_items || []).reduce(
                  (costSum, cost) => costSum + Number(cost.value || 0),
                  0,
                ),
              0,
            );
            const count = dayItems.reduce(
              (sum, item) => sum + (item.cost_items || []).length,
              0,
            );
            return (
              <section
                className={`expense-day-card ${dayItems.length ? "" : "without-timeline"}`}
                key={dayNumber}
              >
                <div className="expense-day-head">
                  <div>
                    <span>DAY {displayTripDay(trip, dayNumber)}</span>
                    <small>{t(`${count} รายการ`)}</small>
                  </div>
                  <div className="expense-day-actions">
                    <strong>฿{dayTotal.toLocaleString()}</strong>
                    <button
                      type="button"
                      disabled={!dayItems.length}
                      title={t(
                        dayItems.length
                          ? `เพิ่มค่าใช้จ่าย Day ${displayTripDay(trip, dayNumber)}`
                          : "วันนี้ยังไม่มี Timeline",
                      )}
                      aria-label={t(
                        dayItems.length
                          ? `เพิ่มค่าใช้จ่าย Day ${displayTripDay(trip, dayNumber)}`
                          : `Day ${displayTripDay(trip, dayNumber)} ยังไม่มี Timeline`,
                      )}
                      onClick={() =>
                        dayItems.length &&
                        openCost(undefined, undefined, dayNumber)
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {count === 0 ? (
                  <p className="expense-day-empty">
                    {t(
                      dayItems.length
                        ? "ยังไม่มีราคาที่กรอกในวันนี้"
                        : "ยังไม่มี Timeline ในวันนี้",
                    )}
                  </p>
                ) : (
                  <div className="expense-day-list">
                    {dayItems.flatMap((item) =>
                      (item.cost_items || []).map((cost, index) => {
                        const isBaht = (cost.currency || "THB") === "THB";
                        return (
                          <button
                            type="button"
                            className="expense-plan-row"
                            key={cost.id || `${item.id}-${index}`}
                            onClick={() => openCost(item, index)}
                          >
                            <div>
                              <strong>{cost.key}</strong>
                              <small>
                                {t(cost.category || "อื่น ๆ")} ·{" "}
                                {item.start_time?.slice(0, 5) || "--:--"} ·{" "}
                                {item.place_name}
                              </small>
                            </div>
                            <span>
                              {!isBaht && (
                                <small>{costSourceLabel(cost)}</small>
                              )}
                              <b>
                                {isBaht ? "" : "≈ "}฿
                                {Number(cost.value).toLocaleString()}
                              </b>
                            </span>
                          </button>
                        );
                      }),
                    )}
                  </div>
                )}
              </section>
            );
          },
        )}
      </div>
    </div>
  );
}

function ExpenseSplitSummary({
  trip,
  tripTotal,
  shoppingTotal,
}: {
  trip: Trip;
  tripTotal: number;
  shoppingTotal: number;
}) {
  const t = useT();
  const tripBudget = Number(trip.budget_thb);
  const shoppingBudget = Number(trip.shopping_budget_thb);
  const tripPercent = tripBudget > 0 ? (tripTotal / tripBudget) * 100 : 0;
  const shoppingPercent =
    shoppingBudget > 0 ? (shoppingTotal / shoppingBudget) * 100 : 0;
  const budgetCard = (
    label: string,
    total: number,
    budget: number,
    percent: number,
    className = "",
  ) => (
    <article
      className={`${className} ${total > budget && budget > 0 ? "over-budget" : ""}`}
    >
      <span>{t(label)}</span>
      <strong>฿{bahtFormat(total)}</strong>
      <div className="expense-budget-meta">
        <small>
          {label === "ค่า Shopping" ? t("งบ Shopping") : t("งบหลัก")} ฿
          {bahtFormat(budget)}
        </small>
        <em>{percent.toFixed(1)}%</em>
      </div>
      <div
        className="expense-budget-progress"
        role="progressbar"
        aria-label={`${t(label)} ${percent.toFixed(1)}%`}
        aria-valuenow={Math.round(Math.min(Math.max(percent, 0), 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
    </article>
  );
  return (
    <section className="separated-expense-totals">
      {budgetCard("ค่าใช้จ่ายทริป", tripTotal, tripBudget, tripPercent)}
      {budgetCard(
        "ค่า Shopping",
        shoppingTotal,
        shoppingBudget,
        shoppingPercent,
        "shopping-total",
      )}
    </section>
  );
}

function PaymentMethodSummary({
  costs,
  cards,
}: {
  costs: CostItem[];
  cards: PaymentCard[];
}) {
  const t = useT();
  const money = (value: number) => bahtFormat(value);
  const rows = Array.from(
    costs.reduce((map, cost) => {
      const method = cost.paymentMethod || "เงินสด";
      const key = cost.creditCardId
        ? `card:${cost.creditCardId}`
        : `method:${method}`;
      const current = map.get(key) || {
        method,
        creditCardId: cost.creditCardId,
        trip: 0,
        shopping: 0,
      };
      if ((cost.category || "").toLowerCase() === "shopping")
        current.shopping += Number(cost.value || 0);
      else current.trip += Number(cost.value || 0);
      map.set(key, current);
      return map;
    }, new Map<string, { method: string; creditCardId?: string; trip: number; shopping: number }>()),
  ).sort((a, b) => b[1].trip + b[1].shopping - (a[1].trip + a[1].shopping));
  return (
    <section className="payment-summary">
      <h3>{t("แยกตามช่องทางชำระ")}</h3>
      {rows.length ? (
        <div>
          {rows.map(([key, amounts]) => {
            const card = findPaymentCard(cards, {
              key: "",
              value: 0,
              paymentMethod: amounts.method,
              creditCardId: amounts.creditCardId,
            });
            return (
              <article key={key}>
                {card ? (
                  <CardBrandLogo
                    brand={card.brand}
                    className="payment-summary-brand"
                  />
                ) : (
                  <CashPaymentIcon className="payment-summary-icon" />
                )}
                <div className="payment-summary-copy">
                  <strong>{card ? cardPaymentLabel(card) : t("เงินสด")}</strong>
                  <small>
                    {card
                      ? `${t("เจ้าของ")}: ${card.owner_name || card.owner_email || "-"}`
                      : t("ใช้ร่วมกันในทริป")}
                  </small>
                </div>
                <div className="payment-method-totals">
                  <span>
                    {t("ค่าใช้จ่ายทริป")} <b>฿{money(amounts.trip)}</b>
                  </span>
                  <span>
                    {t("ค่า Shopping")} <b>฿{money(amounts.shopping)}</b>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p>{t("ยังไม่มีข้อมูลช่องทางชำระ")}</p>
      )}
    </section>
  );
}

function ExpenseMemberSummary({
  costs,
  members,
}: {
  costs: CostItem[];
  members: TripMember[];
}) {
  const t = useT();
  const orderedMembers = ownerLastTripMembers(members);
  const memberIds = new Set(orderedMembers.map((member) => member.id));
  const totals = new Map(
    orderedMembers.map((member) => [
      member.id,
      { trip: 0, shopping: 0 },
    ]),
  );
  for (const cost of costs) {
    const selected = (cost.splitMemberIds || []).filter((id) =>
      memberIds.has(id),
    );
    const participants = selected.length
      ? selected
      : orderedMembers.map((member) => member.id);
    if (!participants.length) continue;
    const share = Number(cost.value || 0) / participants.length;
    const shopping = (cost.category || "").toLowerCase() === "shopping";
    for (const memberId of participants) {
      const total = totals.get(memberId);
      if (!total) continue;
      if (shopping) total.shopping += share;
      else total.trip += share;
    }
  }
  if (!orderedMembers.length) return null;
  return (
    <section className="expense-member-summary">
      <div className="expense-member-summary-head">
        <h3>{t("สรุปค่าใช้จ่ายแยกตามคน")}</h3>
        <p>{t("คำนวณจากผู้ที่เลือกหารในแต่ละรายการ")}</p>
      </div>
      <div>
        {orderedMembers.map((member) => {
          const label = member.display_name || member.email || "-";
          const total = totals.get(member.id) || { trip: 0, shopping: 0 };
          return (
            <article key={member.id}>
              <span
                className="expense-member-avatar"
                style={
                  member.avatar_url
                    ? { backgroundImage: `url("${member.avatar_url}")` }
                    : undefined
                }
              >
                {!member.avatar_url && label.charAt(0).toUpperCase()}
              </span>
              <div className="expense-member-copy">
                <strong>{label}</strong>
                <small>{t("รวมที่ต้องรับผิดชอบ")}</small>
              </div>
              <div className="expense-member-totals">
                <span>
                  {t("ค่าใช้จ่ายทริป")} <b>฿{bahtFormat(total.trip)}</b>
                </span>
                <span>
                  {t("ค่า Shopping")} <b>฿{bahtFormat(total.shopping)}</b>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PlanExpensesContent({
  trip,
  items,
  cards,
  openCost,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  openCost: (item?: Itinerary, index?: number, defaultDay?: number) => void;
}) {
  const t = useT();
  const [showBackTop, setShowBackTop] = useState(false);
  const allCosts = items.flatMap((item) => item.cost_items || []);
  const isShopping = (cost: CostItem) =>
    (cost.category || "").toLowerCase() === "shopping";
  const tripCosts = allCosts.filter((cost) => !isShopping(cost));
  const shoppingCosts = allCosts.filter(isShopping);
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const tripTotal = tripCosts.reduce(
    (sum, cost) => sum + Number(cost.value || 0),
    0,
  );
  const shoppingTotal = shoppingCosts.reduce(
    (sum, cost) => sum + Number(cost.value || 0),
    0,
  );
  const categories = Array.from(
    tripCosts.reduce(
      (map, cost) =>
        map.set(
          cost.category || "อื่น ๆ",
          (map.get(cost.category || "อื่น ๆ") || 0) + Number(cost.value || 0),
        ),
      new Map<string, number>(),
    ),
  ).sort((a, b) => b[1] - a[1]);
  const availableDays = Array.from(
    new Set(items.map((item) => item.day_number)),
  ).sort((a, b) => a - b);
  const firstAvailableDay = availableDays[0];
  return (
    <div className="plan-expenses">
      <div className="toolbar expense-toolbar">
        <div>
          <h2 style={{ margin: 0, fontWeight: 500 }}>
            {t("สรุปค่าใช้จ่ายจากแพลน")}
          </h2>
          <p className="page-sub" style={{ margin: 0 }}>
            {t("ยอดรวมแปลงเป็นเงินบาทด้วยเรตของวันที่บันทึก")}
          </p>
        </div>
      </div>
      <ExpenseSplitSummary
        trip={trip}
        tripTotal={tripTotal}
        shoppingTotal={shoppingTotal}
      />
      <CategoryDonut categories={categories} total={tripTotal} />
      <PaymentMethodSummary costs={allCosts} cards={cards} />
      <ExpenseMemberSummary
        costs={allCosts}
        members={trip.members || []}
      />
      <div className="expense-days">
        {Array.from({ length: trip.total_days }, (_, index) => index + 1).map(
          (dayNumber) => {
            const dayItems = items
              .filter((item) => item.day_number === dayNumber)
              .sort((a, b) =>
                (a.start_time || "99:99").localeCompare(
                  b.start_time || "99:99",
                ),
              );
            const dayCosts = dayItems.flatMap((item) => item.cost_items || []);
            const dayTripTotal = dayCosts
              .filter((cost) => !isShopping(cost))
              .reduce((sum, cost) => sum + Number(cost.value || 0), 0);
            const dayShoppingTotal = dayCosts
              .filter(isShopping)
              .reduce((sum, cost) => sum + Number(cost.value || 0), 0);
            const count = dayCosts.length;
            return (
              <section
                className={`expense-day-card ${dayItems.length ? "" : "without-timeline"}`}
                key={dayNumber}
              >
                <div className="expense-day-head">
                  <div>
                    <span>DAY {displayTripDay(trip, dayNumber)}</span>
                    <small>{t(`${count} รายการ`)}</small>
                  </div>
                  <div className="expense-day-actions">
                    <div className="day-split-total">
                      <span>
                        {t("ค่าใช้จ่ายทริป")}{" "}
                        <strong>฿{bahtFormat(dayTripTotal)}</strong>
                      </span>
                      <span>
                        {t("ค่า Shopping")}{" "}
                        <strong>฿{bahtFormat(dayShoppingTotal)}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!dayItems.length}
                      title={t(
                        dayItems.length
                          ? `เพิ่มค่าใช้จ่าย Day ${displayTripDay(trip, dayNumber)}`
                          : "วันนี้ยังไม่มี Timeline",
                      )}
                      aria-label={t(
                        dayItems.length
                          ? `เพิ่มค่าใช้จ่าย Day ${displayTripDay(trip, dayNumber)}`
                          : `Day ${displayTripDay(trip, dayNumber)} ยังไม่มี Timeline`,
                      )}
                      onClick={() =>
                        dayItems.length &&
                        openCost(undefined, undefined, dayNumber)
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {count === 0 ? (
                  <p className="expense-day-empty">
                    {t(
                      dayItems.length
                        ? "ยังไม่มีราคาที่กรอกในวันนี้"
                        : "ยังไม่มี Timeline ในวันนี้",
                    )}
                  </p>
                ) : (
                  <div className="expense-day-list">
                    {dayItems.flatMap((item) =>
                      (item.cost_items || []).map((cost, costIndex) => {
                        const isBaht = (cost.currency || "THB") === "THB";
                        const card = findPaymentCard(cards, cost);
                        return (
                          <button
                            type="button"
                            className="expense-plan-row"
                            key={cost.id || `${item.id}-${costIndex}`}
                            onClick={() => openCost(item, costIndex)}
                          >
                            <div>
                              <strong>{cost.key}</strong>
                              <small>
                                {t(cost.category || "อื่น ๆ")} ·{" "}
                                {item.start_time?.slice(0, 5) || "--:--"} ·{" "}
                                {item.place_name}
                              </small>
                            </div>
                            <span>
                              <b>
                                {isBaht ? "" : "≈ "}฿{bahtFormat(cost.value)}
                              </b>
                              {!isBaht && (
                                <small>{costSourceLabel(cost)}</small>
                              )}
                              <small className="expense-row-payment">
                                {card ? (
                                  <PaymentOwnerAvatar card={card} />
                                ) : (
                                  <CashPaymentIcon className="expense-cash-mark" />
                                )}
                                <span>
                                  {card ? cardPaymentLabel(card) : t("เงินสด")}
                                </span>
                              </small>
                            </span>
                          </button>
                        );
                      }),
                    )}
                  </div>
                )}
              </section>
            );
          },
        )}
      </div>
      {showBackTop && (
        <button
          type="button"
          className="expense-back-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title={t("กลับด้านบน")}
          aria-label={t("กลับด้านบน")}
        >
          <ArrowUp size={20} />
        </button>
      )}
      <button
        type="button"
        className="directory-fab expense-floating-add"
        disabled={!firstAvailableDay}
        title={t(
          firstAvailableDay ? "เพิ่มค่าใช้จ่าย" : "ต้องเพิ่ม Timeline ก่อน",
        )}
        aria-label={t(
          firstAvailableDay ? "เพิ่มค่าใช้จ่าย" : "ต้องเพิ่ม Timeline ก่อน",
        )}
        onClick={() =>
          firstAvailableDay && openCost(undefined, undefined, firstAvailableDay)
        }
      >
        <Plus size={22} />
        <span>{t("เพิ่มค่าใช้จ่าย")}</span>
      </button>
    </div>
  );
}

function ExpensesScreen({
  trip,
  items,
  cards,
  back,
  openCost,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  back: () => void;
  openCost: (item?: Itinerary, index?: number, defaultDay?: number) => void;
}) {
  return (
    <ExpenseTripMembersContext.Provider value={trip.members || []}>
      <div className="screen trip-hub-screen">
        <div className="trip-cover-region">
          <TripHeader trip={trip} back={back} />
        </div>
        <div className="trip-hub-body">
          <PlanExpensesContent
            trip={trip}
            items={items}
            cards={cards}
            openCost={openCost}
          />
        </div>
      </div>
    </ExpenseTripMembersContext.Provider>
  );
}

function CardSheet({
  card,
  close,
  save,
  remove,
}: {
  card?: PaymentCard;
  close: () => void;
  save: (
    card: PaymentCard | undefined,
    nickname: string,
    brand: CardBrand,
    lastFour: string,
  ) => Promise<void>;
  remove: (card: PaymentCard) => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { formRef, hasChanges, checkForChanges } = useFormDirty(
    card?.id || "new-card",
  );
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nickname = String(form.get("nickname") || "").trim();
    const brand = String(form.get("brand") || "") as CardBrand;
    const lastFour =
      card?.last_four || String(form.get("lastFour") || "").trim();
    if (
      !nickname ||
      !["visa", "mastercard", "jcb"].includes(brand) ||
      !/^\d{4}$/.test(lastFour)
    ) {
      setError(t("ข้อมูลบัตรไม่ถูกต้อง"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await save(card, nickname, brand, lastFour);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("บันทึกไม่สำเร็จ"));
      setSaving(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        ref={formRef}
        className="modal card-sheet"
        onChange={checkForChanges}
        onSubmit={submit}
      >
        <div className="modal-head">
          <h2>{t(card ? "แก้ไขบัตร" : "เพิ่มบัตร")}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label={t("ยกเลิก")}
          >
            <X size={18} />
          </button>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>{t("ชื่อบัตร")}</label>
            <input
              name="nickname"
              required
              maxLength={40}
              autoComplete="off"
              defaultValue={card?.nickname || ""}
              placeholder={t("เช่น KBank Platinum")}
            />
          </div>
          <fieldset className="card-brand-picker">
            <legend>{t("ประเภทบัตร")}</legend>
            {(["visa", "mastercard", "jcb"] as CardBrand[]).map((brand) => (
              <label key={brand}>
                <input
                  type="radio"
                  name="brand"
                  value={brand}
                  required
                  defaultChecked={(card?.brand || "visa") === brand}
                />
                <span>
                  <CardBrandLogo brand={brand} />
                  <b>
                    {brand === "mastercard"
                      ? "Mastercard"
                      : brand.toUpperCase()}
                  </b>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label>{t("เลข 4 หลักสุดท้าย")}</label>
            <div className={`card-last-four-input ${card ? "locked" : ""}`}>
              <span>x-</span>
              <input
                name="lastFour"
                required
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{4}"
                maxLength={4}
                defaultValue={card?.last_four || ""}
                readOnly={Boolean(card)}
                aria-readonly={Boolean(card)}
                placeholder="4323"
              />
            </div>
          </div>
          <p className="card-security-note">
            {t(
              card
                ? "เลข 4 หลักสุดท้ายไม่สามารถแก้ไขได้"
                : "บันทึกเฉพาะชื่อเรียกและเลข 4 หลักท้าย ไม่เก็บเลขบัตรเต็ม",
            )}
          </p>
        </div>
        {error && <p className="login-error">{error}</p>}
        <div className="modal-submit-actions">
          <button className="primary-btn" disabled={saving || !hasChanges}>
            {t(saving ? "กำลังบันทึกบัตร…" : "บันทึกบัตร")}
          </button>
          {card && (
            <button
              type="button"
              className="delete-record-btn"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              aria-label={t("ลบบัตรนี้")}
              title={t("ลบบัตรนี้")}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </form>
      {confirmDelete && card && (
        <ConfirmDialog
          confirmation={{
            title: `ลบ “${card.nickname} · x-${card.last_four}”?`,
            description: "บัตรจะถูกนำออกจากตัวเลือกช่องทางชำระ",
            confirmLabel: "ลบบัตรนี้",
            onConfirm: async () => {
              await remove(card);
              close();
            },
          }}
          close={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function ProfileSettingsCard({
  profile,
  save,
  lang,
  storageAdmin = false,
  storageOpen = false,
  toggleStorage,
}: {
  profile: AccountProfile | null;
  save: (name: string) => Promise<void>;
  lang: Lang;
  storageAdmin?: boolean;
  storageOpen?: boolean;
  toggleStorage?: () => void;
}) {
  const t = (value: string) => (lang === "EN" ? translateUiText(value) : value);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setName(profile?.display_name || ""),
    );
    return () => cancelAnimationFrame(frame);
  }, [profile?.display_name]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await save(name.trim());
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }
  function cancel() {
    setName(profile?.display_name || "");
    setError("");
    setEditing(false);
  }
  return (
    <article className="card account-settings-card">
      <AccountAvatar profile={profile} size="large" />
      <div className="account-settings-copy">
        {editing ? (
          <form onSubmit={submit}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              autoFocus
              required
            />
            <button
              type="button"
              className="account-name-cancel"
              onClick={cancel}
              disabled={saving}
            >
              {t("ยกเลิก")}
            </button>
            <button className="account-name-save" disabled={saving}>
              {t(saving ? "กำลังบันทึก…" : "บันทึก")}
            </button>
          </form>
        ) : (
          <div className="account-name-row">
            <strong>{profile?.display_name || t("กำลังโหลด…")}</strong>
            {profile && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t("แก้ไขชื่อที่แสดง")}
              >
                <Pencil size={15} />
              </button>
            )}
            {storageAdmin && (
              <button
                type="button"
                className={`storage-toggle ${storageOpen ? "active" : ""}`}
                onClick={toggleStorage}
                aria-label={t(
                  storageOpen
                    ? "ซ่อนข้อมูลพื้นที่ระบบ"
                    : "เปิดข้อมูลพื้นที่ระบบ",
                )}
                title={t(
                  storageOpen
                    ? "ซ่อนข้อมูลพื้นที่ระบบ"
                    : "เปิดข้อมูลพื้นที่ระบบ",
                )}
                aria-pressed={storageOpen}
              >
                <Gem size={16} />
              </button>
            )}
          </div>
        )}
        <small>{profile?.email || ""}</small>
        {error && <p className="login-error">{error}</p>}
      </div>
    </article>
  );
}

function StorageUsagePanel({ lang }: { lang: Lang }) {
  const t = (value: string) => (lang === "EN" ? translateUiText(value) : value);
  const [data, setData] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const formatBytes = (value: number | null) => {
    if (value === null) return "—";
    if (value === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1,
    );
    return `${(value / 1024 ** index).toLocaleString("en-US", { maximumFractionDigits: index < 2 ? 0 : 2 })} ${units[index]}`;
  };
  async function requestUsage(signal?: AbortSignal) {
    const response = await fetch("/api/admin/storage-usage", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    const raw = await response.text();
    let payload: StorageUsage & { error?: string };
    try {
      payload = JSON.parse(raw) as StorageUsage & { error?: string };
    } catch {
      throw new Error(
        response.ok
          ? "เซิร์ฟเวอร์ตอบข้อมูลพื้นที่ไม่ถูกต้อง"
          : `ตรวจสอบพื้นที่ไม่สำเร็จ (${response.status})`,
      );
    }
    if (!response.ok)
      throw new Error(
        payload.error || `ตรวจสอบพื้นที่ไม่สำเร็จ (${response.status})`,
      );
    return payload;
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await requestUsage());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลพื้นที่ไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    requestUsage(controller.signal)
      .then(setData)
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError")
          setError(
            reason instanceof Error
              ? reason.message
              : "โหลดข้อมูลพื้นที่ไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  const icon = (id: StorageMetric["id"]) =>
    id === "neon" ? <Database size={17} /> : <Cloud size={17} />;
  return (
    <section className="card storage-admin-card">
      <div className="storage-admin-head">
        <div>
          <span className="mini-kicker">HIDDEN FEATURE</span>
          <h2>{t("พื้นที่ระบบ")}</h2>
          <p>{t("เฉพาะผู้ดูแลระบบ")}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label={t("ตรวจสอบพื้นที่อีกครั้ง")}
          title={t("ตรวจสอบพื้นที่อีกครั้ง")}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {loading && !data ? (
        <p className="storage-loading">{t("กำลังตรวจสอบพื้นที่…")}</p>
      ) : error ? (
        <p className="login-error">{error}</p>
      ) : (
        <div className="storage-metric-list">
          {data?.metrics.map((metric) => {
            const percent =
              metric.percent === null ? null : Math.max(0, metric.percent);
            return (
              <article
                key={metric.id}
                className={`storage-metric storage-${metric.status}`}
              >
                <div className="storage-metric-title">
                  <span>{icon(metric.id)}</span>
                  <div>
                    <strong>{metric.label}</strong>
                    <small>
                      {metric.status === "estimated"
                        ? t("ข้อมูลโดยประมาณ")
                        : metric.status === "unavailable"
                          ? t("ไม่พร้อมใช้งาน")
                          : metric.itemCount !== undefined
                            ? `${metric.itemCount.toLocaleString()} ${t("ไฟล์")}`
                            : "LIVE"}
                    </small>
                  </div>
                  <b>{percent === null ? "—" : `${percent.toFixed(1)}%`}</b>
                </div>
                <div className="storage-values">
                  <strong>{formatBytes(metric.usedBytes)}</strong>
                  <span>
                    {t("จาก")} {formatBytes(metric.limitBytes)}
                  </span>
                </div>
                <div
                  className="storage-progress"
                  role="progressbar"
                  aria-label={`${metric.label} ${percent ?? 0}%`}
                  aria-valuenow={Math.min(100, Math.round(percent ?? 0))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
                </div>
                <p>{metric.detail}</p>
              </article>
            );
          })}
        </div>
      )}
      {data && (
        <small className="storage-updated">
          {t("อัปเดตล่าสุด")}{" "}
          {new Date(data.updatedAt).toLocaleString(
            lang === "EN" ? "en-US" : "th-TH",
            { dateStyle: "medium", timeStyle: "short" },
          )}
        </small>
      )}
    </section>
  );
}

function SettingsContent({
  dark,
  toggleTheme,
  lang,
  setLang,
  logout,
  cards,
  saveCard,
  deleteCard,
  reorderCards,
  clearAllOfflineDocuments,
}: {
  dark: boolean;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  logout: () => void;
  cards: PaymentCard[];
  saveCard: (
    card: PaymentCard | undefined,
    nickname: string,
    brand: CardBrand,
    lastFour: string,
  ) => Promise<void>;
  deleteCard: (card: PaymentCard) => Promise<void>;
  reorderCards: (cards: PaymentCard[]) => Promise<void>;
  clearAllOfflineDocuments: () => void;
}) {
  const t = (value: string) => (lang === "EN" ? translateUiText(value) : value);
  const [cardSheet, setCardSheet] = useState<{ card?: PaymentCard } | null>(
    null,
  );
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [sortingCards, setSortingCards] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draftCards, setDraftCards] = useState(cards);
  const draftCardsRef = useRef(cards);
  const orderedCards = draggingCardId || savingOrder ? draftCards : cards;
  const visibleCards =
    sortingCards || cardsExpanded ? orderedCards : orderedCards.slice(0, 2);
  function moveDraft(cardId: string, targetId: string) {
    if (cardId === targetId) return;
    setDraftCards((current) => {
      const from = current.findIndex((card) => card.id === cardId);
      const to = current.findIndex((card) => card.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      draftCardsRef.current = next;
      return next;
    });
  }
  function beginDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (savingOrder) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draftCardsRef.current = cards;
    setDraftCards(cards);
    setDraggingCardId(cardId);
  }
  function dragCard(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (draggingCardId !== cardId) return;
    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId;
    if (target) moveDraft(cardId, target);
    if (event.clientY < 90) window.scrollBy({ top: -8 });
    else if (event.clientY > window.innerHeight - 90)
      window.scrollBy({ top: 8 });
  }
  async function finishDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (draggingCardId !== cardId) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const next = draftCardsRef.current;
    setDraggingCardId(null);
    setSavingOrder(true);
    try {
      await reorderCards(next);
    } catch {
      draftCardsRef.current = cards;
      setDraftCards(cards);
    } finally {
      setSavingOrder(false);
    }
  }
  function cancelDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (draggingCardId !== cardId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    draftCardsRef.current = cards;
    setDraftCards(cards);
    setDraggingCardId(null);
  }
  async function keyboardMove(cardId: string, direction: -1 | 1) {
    const from = cards.findIndex((card) => card.id === cardId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= cards.length || savingOrder) return;
    const next = [...cards];
    [next[from], next[to]] = [next[to], next[from]];
    draftCardsRef.current = next;
    setDraftCards(next);
    setSavingOrder(true);
    try {
      await reorderCards(next);
    } catch {
      draftCardsRef.current = cards;
      setDraftCards(cards);
    } finally {
      setSavingOrder(false);
    }
  }
  return (
    <div className="screen">
      <h1 className="page-title">{t("ตั้งค่า")}</h1>
      <p className="page-sub">{t("ค่าของบัญชีและอุปกรณ์นี้")}</p>
      <div className="settings-list">
        <article className="card">
          <div className="setting-row">
            <div className="setting-label">
              <span className="stat-icon">
                {dark ? <Moon size={17} /> : <Sun size={17} />}
              </span>
              <div>
                <strong>{t("ธีมการแสดงผล")}</strong>
                <small>{t("สลับ Light / Dark mode")}</small>
              </div>
            </div>
            <div
              className="segmented theme-segmented"
              role="group"
              aria-label={t("เปลี่ยนธีม")}
            >
              <button
                type="button"
                className={!dark ? "active" : ""}
                onClick={() => dark && toggleTheme()}
                aria-label={lang === "EN" ? "Light mode" : "โหมดสว่าง"}
                title={lang === "EN" ? "Light mode" : "โหมดสว่าง"}
                aria-pressed={!dark}
              >
                <Sun size={15} />
              </button>
              <button
                type="button"
                className={dark ? "active" : ""}
                onClick={() => !dark && toggleTheme()}
                aria-label={lang === "EN" ? "Dark mode" : "โหมดมืด"}
                title={lang === "EN" ? "Dark mode" : "โหมดมืด"}
                aria-pressed={dark}
              >
                <Moon size={15} />
              </button>
            </div>
          </div>
        </article>
        <article className="card">
          <div className="setting-row">
            <div className="setting-label">
              <span className="stat-icon">
                <Languages size={17} />
              </span>
              <div>
                <strong>{t("ภาษา · Language")}</strong>
                <small>{t("ภาษาอินเทอร์เฟซหลัก")}</small>
              </div>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={lang === "TH" ? "active" : ""}
                onClick={() => setLang("TH")}
                aria-pressed={lang === "TH"}
              >
                TH
              </button>
              <button
                type="button"
                className={lang === "EN" ? "active" : ""}
                onClick={() => setLang("EN")}
                aria-pressed={lang === "EN"}
              >
                EN
              </button>
            </div>
          </div>
        </article>
        <a className="card master-settings-link" href="/settings/checklists">
          <div className="setting-label">
            <span className="stat-icon">
              <ClipboardList size={17} />
            </span>
            <div>
              <strong>{t("Master Checklist")}</strong>
              <small>{t("จัดหมวดหมู่และรายการสำหรับใช้ซ้ำในทุกทริป")}</small>
            </div>
          </div>
          <ChevronRight size={18} />
        </a>
        <article className="card payment-settings-card">
          <div className="section-head">
            <div>
              <h2>{t("บัตรและการชำระเงิน")}</h2>
              <p>
                {cards.length
                  ? `${cards.length} ${lang === "EN" ? (cards.length === 1 ? "card" : "cards") : "บัตร"}`
                  : t("ยังไม่มีบัตรที่บันทึกไว้")}
              </p>
            </div>
            <div className="card-section-actions">
              {cards.length > 1 && (
                <button
                  type="button"
                  className={`card-sort-btn ${sortingCards ? "active" : ""}`}
                  onClick={() => {
                    if (!draggingCardId) {
                      draftCardsRef.current = cards;
                      setDraftCards(cards);
                      setSortingCards((value) => !value);
                    }
                  }}
                  aria-label={t(sortingCards ? "เสร็จแล้ว" : "จัดลำดับบัตร")}
                  title={t(sortingCards ? "เสร็จแล้ว" : "จัดลำดับบัตร")}
                  aria-pressed={sortingCards}
                >
                  <ArrowUpDown size={16} />
                </button>
              )}
              <button
                type="button"
                className="text-btn card-add-btn"
                onClick={() => setCardSheet({})}
              >
                <Plus size={14} />
                {t("เพิ่มบัตร")}
              </button>
            </div>
          </div>
          {cards.length > 0 && (
            <div
              className={`saved-card-list ${sortingCards ? "sorting" : ""} ${draggingCardId ? "is-dragging" : ""}`}
            >
              {visibleCards.map((card) => (
                <div
                  className={`saved-card-row ${draggingCardId === card.id ? "dragging" : ""}`}
                  key={card.id}
                  data-card-id={card.id}
                >
                  <CardBrandLogo
                    brand={card.brand}
                    className="saved-card-icon"
                  />
                  <button
                    type="button"
                    className="saved-card-main"
                    onClick={() => !sortingCards && setCardSheet({ card })}
                    disabled={sortingCards}
                    aria-label={`${t("แก้ไขบัตร")} ${card.nickname}`}
                  >
                    <strong>{card.nickname}</strong>
                    <small>
                      {card.brand
                        ? `${card.brand === "mastercard" ? "Mastercard" : card.brand.toUpperCase()} · `
                        : ""}
                      x-{card.last_four}
                    </small>
                  </button>
                  {sortingCards ? (
                    <button
                      type="button"
                      className="saved-card-drag"
                      disabled={savingOrder}
                      aria-label={`${t("ลากเพื่อจัดลำดับบัตร")} ${card.nickname}`}
                      onPointerDown={(event) => beginDrag(event, card.id)}
                      onPointerMove={(event) => dragCard(event, card.id)}
                      onPointerUp={(event) => void finishDrag(event, card.id)}
                      onPointerCancel={(event) => cancelDrag(event, card.id)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          void keyboardMove(card.id, -1);
                        } else if (event.key === "ArrowDown") {
                          event.preventDefault();
                          void keyboardMove(card.id, 1);
                        }
                      }}
                    >
                      <GripVertical size={19} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="saved-card-edit"
                      onClick={() => setCardSheet({ card })}
                      aria-label={`${t("แก้ไขบัตร")} ${card.nickname}`}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </div>
              ))}
              {cards.length > 2 && !sortingCards && (
                <button
                  type="button"
                  className="saved-card-expand"
                  onClick={() => setCardsExpanded((value) => !value)}
                  aria-expanded={cardsExpanded}
                >
                  {cardsExpanded ? (
                    <ChevronUp size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )}
                  <span>{t(cardsExpanded ? "ซ่อน" : "ดูทั้งหมด")}</span>
                </button>
              )}
            </div>
          )}
        </article>
        <article className="card offline-documents-setting">
          <div className="setting-row">
            <div className="setting-label">
              <span className="stat-icon">
                <FolderOpen size={17} />
              </span>
              <div>
                <strong>{t("เอกสารออฟไลน์")}</strong>
                <small>
                  {t("ลบเอกสารที่ดาวน์โหลดไว้จากทุกทริปบนอุปกรณ์นี้")}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="settings-clear-offline-btn"
              onClick={clearAllOfflineDocuments}
            >
              {t("เคลียร์ทั้งหมด")}
            </button>
          </div>
        </article>
        <article className="card logout-setting">
          <div className="setting-row">
            <div className="setting-label">
              <span className="stat-icon">
                <LogOut size={17} />
              </span>
              <div>
                <strong>{t("ออกจากระบบ")}</strong>
                <small>{t("ออกจากบัญชีบนอุปกรณ์นี้")}</small>
              </div>
            </div>
            <button
              type="button"
              className="settings-logout-btn"
              onClick={logout}
            >
              {t("ออกจากระบบ")}
            </button>
          </div>
        </article>
      </div>
      {cardSheet && (
        <CardSheet
          card={cardSheet.card}
          close={() => setCardSheet(null)}
          save={saveCard}
          remove={deleteCard}
        />
      )}
    </div>
  );
}

function SettingsScreen(
  props: Parameters<typeof SettingsContent>[0] & {
    demo?: boolean;
    demoAction?: () => void;
    storageAdmin?: boolean;
  },
) {
  const t = (value: string) =>
    props.lang === "EN" ? translateUiText(value) : value;
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  useEffect(() => {
    let active = true;
    getCurrentAccount()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function saveProfile(displayName: string) {
    if (props.demo) {
      props.demoAction?.();
      return;
    }
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("บันทึกไม่สำเร็จ"));
    updateCurrentAccount(data);
    setProfile(data);
  }
  return (
    <div className="settings-page-wrapper">
      <div className="screen settings-account-intro">
        <h1 className="page-title">{t("ตั้งค่า")}</h1>
        <p className="page-sub">{t("ค่าของบัญชีและอุปกรณ์นี้")}</p>
        <ProfileSettingsCard
          profile={profile}
          save={saveProfile}
          lang={props.lang}
          storageAdmin={props.storageAdmin}
          storageOpen={storageOpen}
          toggleStorage={() => setStorageOpen((value) => !value)}
        />
        {props.storageAdmin && storageOpen && (
          <StorageUsagePanel lang={props.lang} />
        )}
      </div>
      <SettingsContent {...props} />
    </div>
  );
}

function ConfirmDialog({
  confirmation,
  close,
}: {
  confirmation: Confirmation;
  close: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add("confirm-open");
    return () => document.documentElement.classList.remove("confirm-open");
  }, []);
  const confirm = async () => {
    setBusy(true);
    try {
      await confirmation.onConfirm();
      close();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <span className="confirm-icon">
          <AlertTriangle size={22} />
        </span>
        <h2 id="confirm-title">{t(confirmation.title)}</h2>
        <p>{t(confirmation.description)}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-cancel"
            onClick={close}
            disabled={busy}
          >
            {t("ยกเลิก")}
          </button>
          <button
            type="button"
            className="confirm-delete"
            onClick={confirm}
            disabled={busy}
          >
            {t(
              busy
                ? confirmation.busyLabel || "กำลังลบ…"
                : confirmation.confirmLabel || "ยืนยันการลบ",
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type CropSource = { file: File; image: HTMLImageElement; url: string };

function CoverImagePicker({
  existingUrl,
  onChange,
}: {
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrls = useRef<string[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const [source, setSource] = useState<CropSource | null>(null);
  const [preview, setPreview] = useState(existingUrl || "");
  const [cropping, setCropping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  function bounds(nextZoom = zoom) {
    if (!source) return { x: 0, y: 0 };
    const scale =
      Math.max(
        1600 / source.image.naturalWidth,
        900 / source.image.naturalHeight,
      ) * nextZoom;
    return {
      x: Math.max(0, (source.image.naturalWidth * scale - 1600) / 2),
      y: Math.max(0, (source.image.naturalHeight * scale - 900) / 2),
    };
  }
  function clampOffset(next: { x: number; y: number }, nextZoom = zoom) {
    const limit = bounds(nextZoom);
    return {
      x: Math.max(-limit.x, Math.min(limit.x, next.x)),
      y: Math.max(-limit.y, Math.min(limit.y, next.y)),
    };
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale =
      Math.max(
        canvas.width / source.image.naturalWidth,
        canvas.height / source.image.naturalHeight,
      ) * zoom;
    const width = source.image.naturalWidth * scale;
    const height = source.image.naturalHeight * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      source.image,
      (canvas.width - width) / 2 + offset.x,
      (canvas.height - height) / 2 + offset.y,
      width,
      height,
    );
  }, [source, zoom, offset]);
  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("รองรับเฉพาะ JPG, PNG และ WebP");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("รูปต้องมีขนาดไม่เกิน 8 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const image = new window.Image();
    image.onload = () => {
      setSource({ file, image, url });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setCropping(true);
    };
    image.onerror = () => setError("ไม่สามารถอ่านไฟล์รูปนี้ได้");
    image.src = url;
  }
  function pointerDistance() {
    const points = Array.from(pointers.current.values());
    return points.length < 2
      ? 0
      : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }
  function startMove(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      dragStart.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      dragStart.current = null;
      pinchStart.current = { distance: pointerDistance(), zoom };
    }
  }
  function moveImage(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (
      pointers.current.size >= 2 &&
      pinchStart.current &&
      pinchStart.current.distance > 0
    ) {
      const distance = pointerDistance();
      const nextZoom = Math.max(
        1,
        Math.min(
          3,
          pinchStart.current.zoom * (distance / pinchStart.current.distance),
        ),
      );
      setZoom(nextZoom);
      setOffset((current) => clampOffset(current, nextZoom));
      return;
    }
    const start = dragStart.current;
    const canvas = canvasRef.current;
    if (!start || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = 1600 / rect.width;
    setOffset(
      clampOffset({
        x: start.offsetX + (event.clientX - start.clientX) * ratio,
        y: start.offsetY + (event.clientY - start.clientY) * ratio,
      }),
    );
  }
  function endMove(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    pinchStart.current = null;
    const remaining = Array.from(pointers.current.values())[0];
    dragStart.current = remaining
      ? {
          clientX: remaining.x,
          clientY: remaining.y,
          offsetX: offset.x,
          offsetY: offset.y,
        }
      : null;
  }
  async function applyCrop() {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    let croppedFile: File;
    try {
      croppedFile = await optimizedCanvasFile(canvas, source.file.name, {
        quality: 0.86,
        minQuality: 0.74,
        targetBytes: 900 * 1024,
        suffix: "cover",
      });
    } catch {
      setError("ไม่สามารถ Crop รูปได้");
      return;
    }
    const url = URL.createObjectURL(croppedFile);
    objectUrls.current.push(url);
    setPreview(url);
    setCropping(false);
    onChange(croppedFile);
  }
  function cancelCrop() {
    pointers.current.clear();
    dragStart.current = null;
    pinchStart.current = null;
    setCropping(false);
    setSource(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  const cropEditor = cropping ? (
    <div
      className="crop-editor"
      role="dialog"
      aria-modal="true"
      aria-label={t("ครอบรูปหน้าปก")}
    >
      <header>
        <button type="button" onClick={cancelCrop} aria-label={t("ยกเลิก")}>
          <X size={20} />
        </button>
        <div>
          <strong>{t("ครอบรูปหน้าปก")}</strong>
          <small>{t("ลากด้วยหนึ่งนิ้ว · จีบเข้า–ออกด้วยสองนิ้ว")}</small>
        </div>
        <span />
      </header>
      <main>
        <div className="fixed-crop-frame">
          <canvas
            ref={canvasRef}
            onPointerDown={startMove}
            onPointerMove={moveImage}
            onPointerUp={endMove}
            onPointerCancel={endMove}
          />
          <span className="crop-gesture-hint">
            {t("ลากเพื่อขยับ · จีบเพื่อซูม")}
          </span>
          <span className="crop-ratio">16 : 9</span>
        </div>
      </main>
      <footer>
        <button type="button" className="crop-apply" onClick={applyCrop}>
          <CheckCircle2 size={18} />
          {t("ยืนยันและกลับไปบันทึก")}
        </button>
      </footer>
    </div>
  ) : null;
  return (
    <div className="cover-picker">
      {!cropping && (
        <label
          className={`upload-field cover-upload ${preview ? "selected" : ""}`}
        >
          <span className="upload-preview">
            {preview && (
              <Image
                src={preview}
                alt={t("รูปหน้าปกที่เลือก")}
                fill
                sizes="36vw"
                unoptimized
                className="upload-preview-image"
              />
            )}
            {!preview && <ImagePlus size={24} />}
          </span>
          <span>
            <strong>
              {preview ? (
                <>
                  <CheckCircle2 size={15} />
                  {t("เลือกรูปแล้ว")}
                </>
              ) : (
                t("เพิ่มรูปหน้าปก")
              )}
            </strong>
            <small>
              {t(
                preview
                  ? "แตะเพื่อเลือกและครอบรูปใหม่"
                  : "เลือกภาพ แล้วจัดตำแหน่งในกรอบแนวนอน 16:9",
              )}
            </small>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectFile}
          />
        </label>
      )}
      {cropEditor && createPortal(cropEditor, document.body)}
      {error && <p className="cover-error">{error}</p>}
    </div>
  );
}

function ReviewMemberAvatar({ item }: { item: TripReview }) {
  const label = (item.display_name || item.email || "?").trim();
  return (
    <span
      className={`review-member-avatar ${item.role === "owner" ? "is-owner" : ""}`}
      style={item.avatar_url ? { backgroundImage: `url("${item.avatar_url}")` } : undefined}
      aria-label={label}
    >
      {!item.avatar_url && label.charAt(0).toUpperCase()}
    </span>
  );
}

function ReviewStars({ value, editable = false, onChange }: { value: number; editable?: boolean; onChange?: (value: number) => void }) {
  return (
    <span className={`review-stars ${editable ? "is-editable" : ""}`} aria-label={`${value.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
        <button
          type="button"
          key={star}
          disabled={!editable}
          onClick={() => onChange?.(star)}
          aria-label={`${star} ดาว`}
        >
          <span className="review-star-glyph">
            <Star size={21} />
            <span
              style={{
                width: `${Math.max(0, Math.min(1, value - (star - 1))) * 100}%`,
              }}
            >
              <Star size={21} fill="currentColor" />
            </span>
          </span>
        </button>
      ))}
    </span>
  );
}

function ReviewRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const normalize = (next: number) =>
    Math.round(Math.max(1, Math.min(5, next)) * 10) / 10;
  const selected = value >= 1 && value <= 5;
  const current = selected ? value : 1;
  return (
    <div className="review-rating-input">
      <div className="review-rating-value">
        <button
          type="button"
          onClick={() => onChange(normalize(selected ? value - 0.1 : 1))}
          disabled={selected && value <= 1}
          aria-label="ลดคะแนน 0.1"
        >
          <Minus size={17} />
        </button>
        <output aria-live="polite">
          <strong>{selected ? value.toFixed(1) : "—"}</strong>
          <small>/ 5.0</small>
        </output>
        <button
          type="button"
          onClick={() => onChange(normalize(selected ? value + 0.1 : 1))}
          disabled={selected && value >= 5}
          aria-label="เพิ่มคะแนน 0.1"
        >
          <Plus size={17} />
        </button>
      </div>
      <input
        type="range"
        min="1"
        max="5"
        step="0.1"
        value={current}
        onChange={(event) => onChange(normalize(Number(event.target.value)))}
        aria-label="คะแนนรีวิว 1.0 ถึง 5.0"
        aria-valuetext={selected ? `${value.toFixed(1)} จาก 5` : "ยังไม่ได้เลือกคะแนน"}
      />
      <div className="review-rating-scale" aria-hidden="true">
        <span>1.0</span>
        <span>ปรับครั้งละ 0.1</span>
        <span>5.0</span>
      </div>
    </div>
  );
}

function ReviewsSheet({
  trip,
  close,
  notify,
  onSaved,
  loginRequired,
}: {
  trip: Trip;
  close: () => void;
  notify: (message: string) => void;
  onSaved: (average: number, count: number) => void;
  loginRequired: () => void;
}) {
  const t = useT();
  const [items, setItems] = useState<TripReview[]>([]);
  const [average, setAverage] = useState(Number(trip.review_average || 0));
  const [count, setCount] = useState(Number(trip.review_count || 0));
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [originalRating, setOriginalRating] = useState(0);
  const [originalReview, setOriginalReview] = useState("");
  const [editingOwnReview, setEditingOwnReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/trips/${trip.id}/reviews`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        const rows = Array.isArray(data.items) ? data.items : [];
        setItems(rows);
        setAverage(Number(data.average || 0));
        setCount(Number(data.count || 0));
        const own = rows.find((item: TripReview) => item.is_current_user);
        const savedRating = own?.rating ? Number(own.rating) : 0;
        const savedReview = own?.review || "";
        setRating(savedRating);
        setReview(savedReview);
        setOriginalRating(savedRating);
        setOriginalReview(savedReview);
        setEditingOwnReview(!savedRating);
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError") setError("โหลดรีวิวไม่สำเร็จ");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [trip.id]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}/reviews`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          review,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.loginRequired) {
          loginRequired();
          return;
        }
        throw new Error(data.error);
      }
      const rows = Array.isArray(data.items) ? data.items : [];
      const own = rows.find((item: TripReview) => item.is_current_user);
      const savedRating = own?.rating ? Number(own.rating) : rating;
      const savedReview = own?.review || "";
      setItems(rows);
      setRating(savedRating);
      setReview(savedReview);
      setOriginalRating(savedRating);
      setOriginalReview(savedReview);
      setAverage(Number(data.average || 0));
      setCount(Number(data.count || 0));
      setEditingOwnReview(false);
      onSaved(Number(data.average || 0), Number(data.count || 0));
      notify("บันทึกรีวิวแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("บันทึกรีวิวไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }
  const hasChanges =
    rating >= 1 &&
    rating <= 5 &&
    (rating !== originalRating || review !== originalReview);
  function cancelEditingOwnReview() {
    setRating(originalRating);
    setReview(originalReview);
    setEditingOwnReview(false);
    setError("");
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal reviews-sheet">
        <div className="modal-head">
          <div>
            <h2>{t("รีวิวทริป")}</h2>
            <p>{t("ให้คะแนน 1.0–5.0 และบันทึกความรู้สึกหลังจบทริป")}</p>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label={t("ยกเลิก")}>
            <X size={18} />
          </button>
        </div>
        <div className="review-average-card">
          <span><Star size={23} fill="currentColor" /></span>
          <div><small>{t("คะแนนเฉลี่ย")}</small><strong>{count ? average.toFixed(1) : "—"}</strong></div>
          <b>{count} {t("รีวิว")}</b>
        </div>
        {loading ? (
          <div className="review-loading">{t("กำลังโหลดรีวิว")}</div>
        ) : (
          <div className="review-member-list">
            {items.map((item) => {
              const itemRating = item.is_current_user
                ? rating
                : Number(item.rating || 0);
              if (item.is_current_user && editingOwnReview)
                return (
                  <form className="review-member-card is-current" key={item.user_id} onSubmit={save}>
                    <div className="review-member-head">
                      <ReviewMemberAvatar item={item} />
                      <div><strong>{item.display_name}</strong><small>{t("รีวิวของคุณ")}</small></div>
                      <b className={`review-selected-score ${rating ? "has-rating" : ""}`}>
                        {rating ? `${rating.toFixed(1)} / 5` : t("เลือกคะแนน")}
                      </b>
                    </div>
                    <ReviewRatingInput
                      value={itemRating}
                      onChange={setRating}
                    />
                    <div className="field review-text-field">
                      <label htmlFor={`trip-review-${item.user_id}`}>{t("เขียนรีวิวของคุณ")}</label>
                      <textarea id={`trip-review-${item.user_id}`} value={review} onChange={(event) => setReview(event.target.value)} maxLength={2000} rows={4} placeholder={t("เล่าความประทับใจ สิ่งที่ชอบ หรือสิ่งที่อยากปรับในทริปหน้า")} />
                    </div>
                    <div className="review-form-actions">
                      <button className="primary-btn" disabled={saving || !hasChanges}>{saving ? t("กำลังบันทึก…") : t("บันทึกรีวิว")}</button>
                      {originalRating > 0 && (
                        <button type="button" className="secondary-btn" onClick={cancelEditingOwnReview} disabled={saving}>{t("ยกเลิก")}</button>
                      )}
                    </div>
                  </form>
                );
              if (item.is_current_user)
                return (
                  <article className="review-member-card is-current" key={item.user_id}>
                    <div className="review-member-head">
                      <ReviewMemberAvatar item={item} />
                      <div><strong>{item.display_name}</strong><small>{t("รีวิวของคุณ")}</small></div>
                      <span className="review-member-actions">
                        <button
                          type="button"
                          className="review-edit-button"
                          onClick={() => setEditingOwnReview(true)}
                          aria-label={t("แก้ไขรีวิว")}
                        >
                          <Pencil size={14} />
                        </button>
                        <b className="review-read-score">{item.rating ? Number(item.rating).toFixed(1) : "—"}</b>
                      </span>
                    </div>
                    {item.rating ? <><ReviewStars value={itemRating} /><p className={item.review ? "review-quote" : "review-empty"}>{item.review ? `“${item.review}”` : t("ยังไม่ได้รีวิว")}</p></> : <p className="review-empty">{t("ยังไม่ได้รีวิว")}</p>}
                  </article>
                );
              return (
                <article className="review-member-card" key={item.user_id}>
                  <div className="review-member-head">
                    <ReviewMemberAvatar item={item} />
                    <div><strong>{item.display_name}</strong><small>{item.role === "owner" ? t("เจ้าของ") : item.email}</small></div>
                    <b className="review-read-score">{item.rating ? Number(item.rating).toFixed(1) : "—"}</b>
                  </div>
                  {item.rating ? <><ReviewStars value={itemRating} /><p className={item.review ? "review-quote" : "review-empty"}>{item.review ? `“${item.review}”` : t("ยังไม่ได้รีวิว")}</p></> : <p className="review-empty">{t("ยังไม่ได้รีวิว")}</p>}
                </article>
              );
            })}
          </div>
        )}
        {error && <p className="login-error">{t(error)}</p>}
      </section>
    </div>
  );
}

function CollaboratorsSheet({
  trip,
  close,
  onChanged,
  confirmRemove,
  notify,
  requestLeave,
}: {
  trip: Trip;
  close: () => void;
  onChanged: () => void;
  confirmRemove: (confirmation: Confirmation) => void;
  notify: (message: string) => void;
  requestLeave: () => void;
}) {
  const t = useT();
  const canManage = trip.access_role === "owner";
  const [items, setItems] = useState<Collaborator[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  useEffect(() => {
    Promise.all([
      fetch(`/api/trips/${trip.id}/collaborators`),
      fetch("/api/collaborators/recent"),
    ])
      .then(async ([membersResponse, recentResponse]) => {
        const members = await membersResponse.json();
        const contacts = await recentResponse.json();
        if (!membersResponse.ok) throw new Error(members.error);
        setItems(members);
        setRecent(
          Array.isArray(contacts)
            ? contacts.map((contact) => contact.email)
            : [],
        );
      })
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "โหลดผู้ร่วมทริปไม่สำเร็จ",
        ),
      )
      .finally(() => setLoading(false));
  }, [trip.id]);
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}/collaborators`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((old) => [...old.filter((item) => item.id !== data.id), data]);
      setRecent((old) => [
        data.email,
        ...old.filter((value) => value !== data.email),
      ]);
      setEmail("");
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เพิ่มผู้ร่วมทริปไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: Collaborator) {
    setError("");
    const response = await fetch(
      `/api/trips/${trip.id}/collaborators/${item.id}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    if (!response.ok) {
      const message = data.error || "ลบผู้ร่วมทริปไม่สำเร็จ";
      setError(message);
      throw new Error(message);
    }
    setItems((old) => old.filter((row) => row.id !== item.id));
    onChanged();
    notify("ลบผู้ร่วมทริปสำเร็จแล้ว");
  }
  async function updateAccess(item: Collaborator, accessLevel: "view" | "admin") {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/trips/${trip.id}/collaborators/${item.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessLevel }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems((current) =>
        current.map((member) =>
          member.id === item.id
            ? { ...member, access_level: accessLevel }
            : member,
        ),
      );
      onChanged();
      notify(accessLevel === "admin" ? "เปลี่ยนสิทธิ์เป็น Admin แล้ว" : "เปลี่ยนสิทธิ์เป็น View แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปลี่ยนสิทธิ์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  function askRemove(item: Collaborator) {
    confirmRemove({
      title: `ลบผู้ร่วมทริป “${item.email}”?`,
      description: "ผู้ร่วมทริปคนนี้จะไม่สามารถเข้าถึงหรือแก้ไขทริปนี้ได้อีก",
      confirmLabel: "ลบผู้ร่วมทริป",
      onConfirm: () => remove(item),
    });
  }
  const suggestions = recent.filter(
    (value) => !items.some((item) => item.email === value),
  );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section className="modal collaborators-sheet">
        <div className="modal-head">
          <div>
            <h2>{t("ผู้ร่วมทริป")}</h2>
            <p>
              {t(
                canManage
                  ? "กำหนด View สำหรับเพิ่มและแก้ไข หรือ Admin สำหรับลบข้อมูลได้ด้วย"
                  : "ดูสมาชิกในทริป หรือเลือกออกจากทริปนี้",
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label={t("ยกเลิก")}
          >
            <X size={18} />
          </button>
        </div>
        {canManage && (
          <form className="collaborator-form" onSubmit={add}>
            <div className="field">
              <label>{t("อีเมลผู้ร่วมทริป")}</label>
              <input
                name="email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="friend@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <button
              className="primary-btn"
              disabled={saving || !email.trim()}
            >
              <UserPlus size={16} />
              {t(saving ? "กำลังเพิ่ม…" : "เพิ่มผู้ร่วมทริป")}
            </button>
            {suggestions.length > 0 && (
              <div className="recent-collaborators">
                <small>{t("เลือกจากคนที่เพิ่มล่าสุด")}</small>
                <div>
                  {suggestions.map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => setEmail(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
        {error && <p className="login-error">{t(error)}</p>}
        <div className="collaborator-list">
          {loading ? (
            <p>{t("กำลังโหลด…")}</p>
          ) : items.length ? (
            items.map((item) => (
              <div
                className={`collaborator-row ${canManage ? "" : "is-readonly"}`}
                key={item.id}
              >
                <CollaboratorAvatar item={item} />
                <div className="collaborator-copy">
                  <strong>{item.display_name || item.email}</strong>
                  <small>
                    {item.display_name
                      ? item.email
                      : t(item.joined ? "เข้าร่วมแล้ว" : "รอการตอบรับ")}
                  </small>
                </div>
                {canManage ? (
                  <div className={`collaborator-access-control is-${item.access_level || "view"}`}>
                    <select
                      className="collaborator-access-select"
                      value={item.access_level || "view"}
                      onChange={(event) =>
                        void updateAccess(
                          item,
                          event.target.value as "view" | "admin",
                        )
                      }
                      disabled={saving}
                      aria-label={t(`กำหนดสิทธิ์ ${item.email}`)}
                    >
                      <option value="view">View</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                  </div>
                ) : (
                  <span className={`collaborator-access-badge is-${item.access_level}`}>
                    {item.access_level === "admin" ? "Admin" : "View"}
                  </span>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="delete-record-btn"
                    onClick={() => askRemove(item)}
                    aria-label={t("นำผู้ร่วมทริปออก")}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="collaborator-empty">{t("ยังไม่มีผู้ร่วมทริป")}</p>
          )}
        </div>
        {!canManage && (
          <button
            type="button"
            className="primary-btn collaborator-leave-btn"
            onClick={requestLeave}
          >
            <LogOut size={17} />
            {t("ออกจากทริป")}
          </button>
        )}
      </section>
    </div>
  );
}

function CostSheet({
  modal,
  trip,
  items,
  cards,
  close,
  saveCost,
  deleteCost,
  canDelete,
}: {
  modal: Extract<NonNullable<Modal>, { type: "cost" }>;
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  close: () => void;
  saveCost: (
    source: Itinerary | undefined,
    index: number | undefined,
    target: Itinerary,
    cost: CostItem,
  ) => Promise<void>;
  deleteCost: (item: Itinerary, index: number) => Promise<void>;
  canDelete: boolean;
}) {
  const t = useT();
  const existing =
    modal.item && modal.costIndex !== undefined
      ? modal.item.cost_items[modal.costIndex]
      : undefined;
  const availableDays = Array.from(
    new Set(items.map((item) => item.day_number)),
  ).sort((a, b) => a - b);
  const requestedDay = modal.item?.day_number || modal.defaultDay;
  const initialDay =
    requestedDay && availableDays.includes(requestedDay)
      ? requestedDay
      : availableDays[0] || 1;
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const dayItems = items
    .filter((item) => item.day_number === selectedDay)
    .sort((a, b) =>
      (a.start_time || "99:99").localeCompare(b.start_time || "99:99"),
    );
  const [targetId, setTargetId] = useState(
    modal.item?.id || dayItems[0]?.id || "",
  );
  const [currency, setCurrency] = useState(existing?.currency || "THB");
  const dayDate = (day: number) =>
    addDays(localDate(trip.outbound_departure_at, trip.start_date), day - 1);
  const [exchangeRate, setExchangeRate] = useState(
    String(existing?.exchangeRate ?? 1),
  );
  const [rateDate, setRateDate] = useState(
    existing?.rateDate || dayDate(initialDay),
  );
  const [rateLoading, setRateLoading] = useState(false);
  const [rateEstimated, setRateEstimated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const splitMembers = ownerLastTripMembers(trip.members || []);
  const allSplitMemberIds = splitMembers.map((member) => member.id);
  const existingSplitMemberIds = (existing?.splitMemberIds || []).filter(
    (id) => allSplitMemberIds.includes(id),
  );
  const [splitMemberIds, setSplitMemberIds] = useState<string[]>(
    existingSplitMemberIds.length
      ? existingSplitMemberIds
      : allSplitMemberIds,
  );
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);
  const splitPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!splitPickerOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !splitPickerRef.current?.contains(event.target)
      )
        setSplitPickerOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSplitPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [splitPickerOpen]);
  const { formRef, hasChanges, checkForChanges } = useFormDirty(
    `${modal.item?.id || "new"}:${modal.costIndex ?? "cost"}`,
  );
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  async function loadRate(nextCurrency: string, date: string) {
    setCurrency(nextCurrency);
    setRateDate(date);
    if (nextCurrency === "THB") {
      setExchangeRate("1");
      setRateEstimated(false);
      return;
    }
    setRateLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/exchange-rate?currency=${nextCurrency}&date=${date}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setExchangeRate(String(data.rate));
      setRateDate(data.date);
      setRateEstimated(Boolean(data.estimated));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "โหลดอัตราแลกเปลี่ยนไม่สำเร็จ",
      );
    } finally {
      setRateLoading(false);
    }
  }
  async function handle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = items.find((item) => item.id === targetId);
    if (!target) {
      setError("กรุณาเลือกจุดใน Timeline");
      return;
    }
    const foreignAmount = Number(
      String(form.get("foreignAmount") || "0").replace(/,/g, ""),
    );
    const rate = Number(exchangeRate || 1);
    if (!Number.isFinite(foreignAmount) || foreignAmount < 0) {
      setError("กรุณากรอกยอดเงินให้ถูกต้อง");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("กรุณากรอกอัตราแลกเปลี่ยนให้ถูกต้อง");
      return;
    }
    if (allSplitMemberIds.length && !splitMemberIds.length) {
      setError("กรุณาเลือกผู้ร่วมทริปอย่างน้อย 1 คน");
      return;
    }
    const paymentSource = String(form.get("paymentSource") || "cash");
    const selectedCard = cards.find((card) => card.id === paymentSource);
    const cost: CostItem = {
      id: existing?.id || crypto.randomUUID(),
      key: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "อื่น ๆ"),
      currency,
      foreignAmount,
      exchangeRate: rate,
      rateDate,
      paymentMethod: selectedCard
        ? tripCardPaymentLabel(selectedCard)
        : "เงินสด",
      creditCardId: selectedCard?.id,
      paymentOwnerName: selectedCard?.owner_name,
      splitMemberIds: splitMemberIds.length ? splitMemberIds : undefined,
      value: Math.round(foreignAmount * rate * 100) / 100,
    };
    setSaving(true);
    setError("");
    try {
      await saveCost(modal.item, modal.costIndex, target, cost);
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "บันทึกค่าใช้จ่ายไม่สำเร็จ",
      );
      setSaving(false);
    }
  }
  const existingCard = findPaymentCard(cards, existing);
  const selectedPaymentSource = existingCard?.id || "cash";
  const categories = [
    "อาหาร",
    "เดินทาง",
    "ค่าตั๋วเครื่องบิน",
    "ที่พัก",
    "Shopping",
    "กิจกรรม",
    "ของฝาก",
    "อื่น ๆ",
  ];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <form
        ref={formRef}
        className="modal cost-sheet"
        onChange={checkForChanges}
        onSubmit={handle}
      >
        <div className="modal-head">
          <div>
            <h2>{t(existing ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย")}</h2>
            <p>
              {t(
                existing
                  ? "แก้ไขหรือย้ายรายการไปยัง Timeline อื่นได้"
                  : "เลือกรายการในแพลนที่ค่าใช้จ่ายนี้เกิดขึ้น",
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label={t("ยกเลิก")}
          >
            <X size={18} />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <div className="field">
              <label>{t("วันที่")}</label>
              <select
                name="dayNumber"
                value={selectedDay}
                onChange={(event) => {
                  const nextDay = Number(event.target.value);
                  const date = dayDate(nextDay);
                  setSelectedDay(nextDay);
                  setTargetId(
                    items.find((item) => item.day_number === nextDay)?.id || "",
                  );
                  void loadRate(currency, date);
                }}
              >
                {availableDays.map((day) => (
                  <option key={day} value={day}>
                    Day {displayTripDay(trip, day)} ·{" "}
                    {tripDayLabel(
                      localDate(trip.outbound_departure_at, trip.start_date),
                      day,
                    )}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("จุดใน Timeline")}</label>
              <select
                name="targetId"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                required
                disabled={!dayItems.length}
              >
                <option value="">
                  {t(
                    dayItems.length
                      ? "เลือก Timeline"
                      : "วันนี้ยังไม่มี Timeline",
                  )}
                </option>
                {dayItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.start_time?.slice(0, 5) || "--:--"} ·{" "}
                    {item.place_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>{t("รายการ")}</label>
            <input
              name="title"
              required
              defaultValue={existing?.key}
              placeholder={t("เช่น ค่าอาหารเย็น")}
            />
          </div>
          <div className="form-row expense-category-split-row">
            <div className="field">
              <label>{t("หมวดหมู่")}</label>
              {modal.item?.accommodation_id && (
                <input type="hidden" name="category" value="ที่พัก" />
              )}
              <select
                name="category"
                defaultValue={
                  modal.item?.accommodation_id
                    ? "ที่พัก"
                    : existing?.category || "อาหาร"
                }
                disabled={Boolean(modal.item?.accommodation_id)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field split-member-field" ref={splitPickerRef}>
              <label>{t("หารกับ")}</label>
              <button
                type="button"
                className={`split-member-trigger ${splitPickerOpen ? "is-open" : ""}`}
                onClick={() => setSplitPickerOpen((value) => !value)}
                aria-expanded={splitPickerOpen}
              >
                <span>
                  {splitMemberIds.length === allSplitMemberIds.length
                    ? t("หารทุกคน")
                    : splitMemberIds.length === 1
                      ? splitMembers.find(
                          (member) => member.id === splitMemberIds[0],
                        )?.display_name || t("1 คน")
                      : t(`${splitMemberIds.length} คน`)}
                </span>
                <ChevronDown size={16} />
              </button>
              {splitPickerOpen && (
                <div className="split-member-menu">
                  <label>
                    <input
                      type="checkbox"
                      name="splitAll"
                      checked={
                        allSplitMemberIds.length > 0 &&
                        splitMemberIds.length === allSplitMemberIds.length
                      }
                      onChange={(event) =>
                        setSplitMemberIds(
                          event.target.checked ? allSplitMemberIds : [],
                        )
                      }
                    />
                    <span className="split-checkmark" aria-hidden="true" />
                    <span>{t("หารทุกคน")}</span>
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
                          onChange={(event) =>
                            setSplitMemberIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, member.id])]
                                : current.filter((id) => id !== member.id),
                            )
                          }
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
                </div>
              )}
            </div>
          </div>
          <div className="form-row money-currency-row">
            <div className="field">
              <label>{t("ยอดเงิน")}</label>
              <MoneyInput
                name="foreignAmount"
                required
                defaultValue={existing?.foreignAmount ?? existing?.value}
              />
            </div>
            <div className="field">
              <label>{t("สกุลเงิน")}</label>
              <select
                name="currency"
                value={currency}
                onChange={(event) =>
                  void loadRate(event.target.value, dayDate(selectedDay))
                }
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {currency !== "THB" && (
            <p className={`exchange-rate-note ${rateLoading ? "loading" : ""}`}>
              {rateLoading
                ? t("กำลังโหลดอัตราแลกเปลี่ยน…")
                : `1 ${currency} = ${exchangeRate} THB · ${t(rateEstimated ? "เรตล่าสุดสำหรับวันในอนาคต" : "เรตประจำวันที่")} ${rateDate}`}
            </p>
          )}
          <fieldset className="expense-payment-picker">
            <legend>{t("ช่องทางชำระ")}</legend>
            <label>
              <input
                type="radio"
                name="paymentSource"
                value="cash"
                defaultChecked={selectedPaymentSource === "cash"}
              />
              <span className="expense-payment-option">
                <CashPaymentIcon className="payment-cash-icon" />
                <span>
                  <b>{t("เงินสด")}</b>
                  <small>{t("ใช้ร่วมกันในทริป")}</small>
                </span>
              </span>
            </label>
            {cards.map((card) => (
              <label key={card.id}>
                <input
                  type="radio"
                  name="paymentSource"
                  value={card.id}
                  defaultChecked={selectedPaymentSource === card.id}
                />
                <span className="expense-payment-option">
                  <CardBrandLogo brand={card.brand} />
                  <span>
                    <b>{card.nickname}</b>
                    <small>
                      {card.owner_name || card.owner_email} · x-{card.last_four}
                    </small>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        {error && <p className="login-error">{t(error)}</p>}
        <div className="modal-submit-actions">
          <button
            className="primary-btn"
            disabled={saving || rateLoading || !targetId || !hasChanges}
          >
            {t(saving ? "กำลังบันทึก…" : "บันทึกค่าใช้จ่าย")}
          </button>
          {canDelete &&
            existing &&
            modal.item &&
            modal.costIndex !== undefined && (
              <button
                type="button"
                className="delete-record-btn"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                aria-label={t("ลบค่าใช้จ่ายนี้")}
                title={t("ลบค่าใช้จ่ายนี้")}
              >
                <Trash2 size={18} />
              </button>
            )}
        </div>
      </form>
      {canDelete &&
        confirmDelete &&
        modal.item &&
        modal.costIndex !== undefined && (
          <ConfirmDialog
            confirmation={{
              title: `ลบ “${existing?.key}”?`,
              description: "ค่าใช้จ่ายนี้จะถูกลบออกจาก Timeline และหน้าสรุป",
              confirmLabel: "ลบค่าใช้จ่าย",
              onConfirm: async () => {
                await deleteCost(modal.item!, modal.costIndex!);
                setConfirmDelete(false);
                close();
              },
            }}
            close={() => setConfirmDelete(false)}
          />
        )}
    </div>
  );
}

function TripLocationInput({
  items,
  currentItem,
}: {
  items: Itinerary[];
  currentItem?: Itinerary;
}) {
  const t = useT();
  const [value, setValue] = useState(currentItem?.address || "");
  const [open, setOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const suggestions = [...items]
    .sort(
      (a, b) =>
        b.day_number - a.day_number ||
        (b.start_time || "").localeCompare(a.start_time || ""),
    )
    .filter((item) => Boolean(item.address?.trim()))
    .filter((item) => {
      const key = item.address!.trim().toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((item) => {
      const address = item.address!.trim().toLocaleLowerCase();
      const name = item.place_name.trim().toLocaleLowerCase();
      return (
        Boolean(query) &&
        address !== query &&
        (address.includes(query) || name.includes(query))
      );
    })
    .slice(0, 6);
  const showSuggestions = open && suggestions.length > 0;
  return (
    <div className="field trip-location-field">
      <label htmlFor="trip-location-input">{t("สถานที่ / ที่อยู่")}</label>
      <input
        id="trip-location-input"
        name="address"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls="trip-location-suggestions"
      />
      {showSuggestions && (
        <div
          id="trip-location-suggestions"
          className="trip-location-suggestions"
          role="listbox"
          aria-label={t("สถานที่ที่เคยใช้ในทริปนี้")}
        >
          {suggestions.map((item) => (
            <button
              key={item.address!.trim().toLocaleLowerCase()}
              type="button"
              role="option"
              aria-selected="false"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                setValue(item.address!.trim());
                setOpen(false);
              }}
            >
              <MapPin size={15} />
              <span>
                <strong>{item.address!.trim()}</strong>
                {item.place_name.trim() !== item.address!.trim() && (
                  <small>{item.place_name}</small>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModalForm({
  modal,
  trip,
  day,
  items,
  close,
  submit,
  deleteItem,
  deleteTrip,
  canDelete,
}: {
  modal: Extract<NonNullable<Modal>, { type: "trip" | "place" }>;
  trip: Trip | null;
  day: number;
  items: Itinerary[];
  close: () => void;
  submit: (data: Record<string, unknown>) => Promise<void>;
  deleteItem: (item: Itinerary) => Promise<void>;
  deleteTrip: (trip: Trip) => Promise<void>;
  canDelete: boolean;
}) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [confirmDisableFlights, setConfirmDisableFlights] = useState(false);
  const flightDisableConfirmed = useRef(false);
  const formDirtyKey =
    modal.type === "trip"
      ? `trip:${modal.trip?.id || "new"}`
      : `place:${modal.item?.id || modal.duplicateOf?.id || "new"}`;
  const { formRef, hasChanges, checkForChanges } = useFormDirty(
    formDirtyKey,
    modal.type === "place" && Boolean(modal.duplicateOf),
  );
  const initialCountry =
    modal.type === "trip"
      ? countryByCode(modal.trip?.country_code) ||
        inferTripCountry(modal.trip?.destination, modal.trip?.timezone)
      : TRIP_COUNTRIES[0];
  const [countryCode, setCountryCode] = useState(initialCountry.code);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  const initialOutboundDate =
    modal.type === "trip"
      ? localDate(
          modal.trip?.outbound_departure_at,
          modal.trip?.start_date || "",
        )
      : "";
  const returnFallback =
    modal.type === "trip" && modal.trip
      ? addDays(modal.trip.start_date, modal.trip.total_days - 1)
      : "";
  const savedReturnDate =
    modal.type === "trip"
      ? localDate(modal.trip?.return_departure_at, returnFallback)
      : "";
  const initialReturnDate =
    initialOutboundDate && savedReturnDate < initialOutboundDate
      ? addDays(initialOutboundDate, 1)
      : savedReturnDate;
  const [outboundDate, setOutboundDate] = useState(initialOutboundDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const placeSource =
    modal.type === "place" ? modal.item || modal.duplicateOf : undefined;
  const initialPlaceDay =
    modal.type === "place" ? placeSource?.day_number || day : day;
  const [placeDay, setPlaceDay] = useState(initialPlaceDay);
  const [placeStartTime, setPlaceStartTime] = useState(
    modal.type === "place"
      ? modal.item
        ? modal.item.start_time?.slice(0, 5) || "09:00"
        : modal.duplicateOf
          ? shiftedPlanTime(modal.duplicateOf.start_time)
          : nextPlanTime(items, initialPlaceDay)
      : "09:00",
  );
  const placeIsFirst =
    modal.type === "place" &&
    !items.some(
      (item) =>
        item.id !== modal.item?.id &&
        item.day_number === placeDay &&
        (item.start_time || "99:99").slice(0, 5) < placeStartTime,
    );
  const amount = (f: FormData, name: string) =>
    Number(String(f.get(name) || "0").replace(/,/g, ""));
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      modal.type === "trip" &&
      modal.trip?.has_flights &&
      f.get("hasFlights") !== "true" &&
      !flightDisableConfirmed.current
    ) {
      setConfirmDisableFlights(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (modal.type === "trip") {
        let coverImageUrl = modal.trip?.cover_image_url || DEFAULT_TRIP_COVER;
        if (coverFile) {
          const upload = new FormData();
          upload.set("file", coverFile);
          const response = await fetch("/api/uploads", {
            method: "POST",
            body: upload,
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "อัปโหลดรูปไม่สำเร็จ");
          coverImageUrl = result.url;
        }
        await submit({
          name: f.get("name"),
          destination: f.get("destination"),
          countryCode: f.get("countryCode"),
          googlePhotosUrl: String(f.get("googlePhotosUrl") || "").trim(),
          outboundDate: f.get("outboundDate"),
          outboundTime: f.get("outboundTime"),
          returnDate: f.get("returnDate"),
          returnTime: f.get("returnTime"),
          budgetThb: amount(f, "budgetThb"),
          shoppingBudgetThb: amount(f, "shoppingBudgetThb"),
          hasFlights: f.get("hasFlights") === "true",
          coverImageUrl,
        });
      }
      if (modal.type === "place") {
        const startTime = String(f.get("startTime"));
        const hour = Number(startTime.slice(0, 2));
        const timeSlot =
          hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        await submit({
          placeName: f.get("placeName"),
          address: f.get("address"),
          transportMode: placeIsFirst
            ? undefined
            : f.get("transportMode"),
          transportNote: f.get("transportNote"),
          costItems: modal.item?.cost_items || [],
          dayNumber: Number(f.get("dayNumber")),
          timeSlot,
          startTime,
        });
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setSaving(false);
    }
  }
  const title = t(
    modal.type === "trip"
      ? modal.trip
        ? "แก้ไขทริป"
        : "สร้างทริปใหม่"
      : modal.item
        ? "แก้ไขรายการ"
        : modal.duplicateOf
          ? "ทำสำเนาแผน"
          : "เพิ่มแผนเที่ยว",
  );
  const transportOptions = [
    "เดิน",
    "รถไฟ",
    "รถยนต์",
    "รถบัส",
    "แท็กซี่",
    "เครื่องบิน",
    "เรือ",
  ];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        ref={formRef}
        className="modal"
        onChange={checkForChanges}
        onSubmit={handle}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label={t("ยกเลิก")}
          >
            <X size={18} />
          </button>
        </div>
        <div className="form-grid">
          {modal.type === "trip" && (
            <>
              <CoverImagePicker
                existingUrl={modal.trip?.cover_image_url}
                onChange={(file) => {
                  setCoverFile(file);
                  checkForChanges();
                }}
              />
              <div className="field">
                <label>{t("ชื่อทริป")}</label>
                <input name="name" required defaultValue={modal.trip?.name} />
              </div>
              <div className="form-row trip-destination-row">
                <div className="field">
                  <label>{t("เมือง")}</label>
                  <input
                    name="destination"
                    required
                    defaultValue={tripCity(modal.trip?.destination)}
                  />
                </div>
                <div className="field country-select-field">
                  <label>{t("ประเทศ")}</label>
                  <select
                    name="countryCode"
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
                  >
                    {TRIP_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {lang === "EN" ? country.nameEn : country.nameTh}
                      </option>
                    ))}
                  </select>
                  <small>
                    {t("เวลาอัตโนมัติ")}: {countryByCode(countryCode)?.timezone}
                  </small>
                </div>
              </div>
              <div className="field">
                <label>{t("ลิงก์โฟลเดอร์ Google Photos")}</label>
                <input
                  name="googlePhotosUrl"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  defaultValue={modal.trip?.google_photos_url || ""}
                  placeholder="https://photos.app.goo.gl/..."
                />
              </div>
              <div className="field">
                <label className="trip-flight-checkbox">
                  <input name="hasFlights" type="checkbox" value="true" defaultChecked={Boolean(modal.trip?.has_flights)} />
                  <span className="split-checkmark" aria-hidden="true" />
                  <strong>{t("เดินทางแบบมีเที่ยวบิน")}</strong>
                </label>
              </div>
              <div className="form-row flight-datetime-row">
                <div className="field">
                  <label>{t("วันเดินทางไป")}</label>
                  <NativeDateTimeInput
                    name="outboundDate"
                    type="date"
                    required
                    defaultValue={initialOutboundDate}
                    value={outboundDate}
                    onValueChange={(value) => {
                      setOutboundDate(value);
                      setReturnDate((current) =>
                        !value
                          ? ""
                          : current && current >= value
                            ? current
                            : addDays(value, 1),
                      );
                    }}
                    label={t("วันเดินทางไป")}
                  />
                </div>
                <div className="field">
                  <label>{t("เวลาเดินทางไป")}</label>
                  <NativeDateTimeInput
                    name="outboundTime"
                    type="time"
                    required
                    defaultValue={localTime(modal.trip?.outbound_departure_at)}
                    label={t("เวลาเดินทางไป")}
                  />
                </div>
              </div>
              <div
                className={`form-row flight-datetime-row ${outboundDate ? "" : "disabled-row"}`}
              >
                <div className="field">
                  <label>{t("วันเดินทางกลับ")}</label>
                  <NativeDateTimeInput
                    name="returnDate"
                    type="date"
                    required
                    defaultValue={initialReturnDate}
                    value={returnDate}
                    onValueChange={setReturnDate}
                    min={outboundDate || undefined}
                    disabled={!outboundDate}
                    label={t("วันเดินทางกลับ")}
                  />
                </div>
                <div className="field">
                  <label>{t("เวลาเดินทางกลับ")}</label>
                  <NativeDateTimeInput
                    name="returnTime"
                    type="time"
                    required
                    defaultValue={localTime(
                      modal.trip?.return_departure_at,
                      "18:00",
                    )}
                    disabled={!outboundDate}
                    label={t("เวลาเดินทางกลับ")}
                  />
                </div>
              </div>
              <div className="form-row budget-row">
                <div className="field">
                  <label>{t("งบหลัก (THB)")}</label>
                  <MoneyInput
                    name="budgetThb"
                    required
                    defaultValue={modal.trip?.budget_thb || 0}
                  />
                </div>
                <div className="field">
                  <label>{t("งบ Shopping (THB)")}</label>
                  <MoneyInput
                    name="shoppingBudgetThb"
                    required
                    defaultValue={modal.trip?.shopping_budget_thb || 0}
                  />
                </div>
              </div>
            </>
          )}
          {modal.type === "place" && (
            <>
              <div className="form-row">
                <div className="field">
                  <label>{t("วัน")}</label>
                  <select
                    name="dayNumber"
                    required
                    value={placeDay}
                    onChange={(event) => {
                      const nextDay = Number(event.target.value);
                      setPlaceDay(nextDay);
                      if (!modal.item)
                        setPlaceStartTime(nextPlanTime(items, nextDay));
                    }}
                  >
                    {Array.from(
                      { length: trip?.total_days || 1 },
                      (_, index) => index + 1,
                    ).map((number) => (
                      <option key={number} value={number}>
                        Day {displayTripDay(trip, number)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{t("เวลา")}</label>
                  <NativeDateTimeInput
                    name="startTime"
                    type="time"
                    required
                    defaultValue={placeStartTime}
                    value={placeStartTime}
                    onValueChange={setPlaceStartTime}
                    label={t("เวลาเริ่มรายการ")}
                  />
                </div>
              </div>
              <p className="field-hint">
                {t(
                  "เปลี่ยนแผนได้ทุกเมื่อ ระบบจะย้ายรายการไปยังวันที่เลือกและเรียงตามเวลาให้อัตโนมัติ",
                )}
              </p>
              <div className="field">
                <label>{t("ชื่อรายการ")}</label>
                <input
                  name="placeName"
                  required
                  defaultValue={placeSource?.place_name}
                />
              </div>
              <TripLocationInput
                key={`${modal.item ? "edit" : modal.duplicateOf ? "duplicate" : "new"}-${placeSource?.id || "location"}`}
                items={items}
                currentItem={placeSource}
              />
              {!placeIsFirst && (
                <div className="field">
                  <label>{t("วิธีเดินทางมาที่นี่")}</label>
                  <select
                    name="transportMode"
                    defaultValue={placeSource?.transport_mode || ""}
                  >
                    <option value="">{t("- / ไม่ระบุ")}</option>
                    {transportOptions.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>{t("รายละเอียด")}</label>
                <textarea
                  name="transportNote"
                  rows={3}
                  defaultValue={placeSource?.transport_note || ""}
                  placeholder={t("รายละเอียดร้าน การเดินทาง หรือสิ่งที่ต้องจำ")}
                />
              </div>
            </>
          )}
        </div>
        {error && <p className="login-error">{t(error)}</p>}
        <div className="modal-submit-actions">
          <button
            className="primary-btn"
            disabled={saving || (!hasChanges && !coverFile)}
          >
            {t(saving ? "กำลังบันทึก…" : "บันทึก")}
          </button>
          {canDelete &&
            ((modal.type === "place" && modal.item) ||
              (modal.type === "trip" && modal.trip)) && (
              <button
                type="button"
                className="delete-record-btn"
                onClick={() => setPendingDelete(true)}
                disabled={saving}
                aria-label={t(modal.type === "trip" ? "ลบทริป" : "ลบรายการ")}
                title={t(modal.type === "trip" ? "ลบทริป" : "ลบรายการ")}
              >
                <Trash2 size={18} />
              </button>
            )}
        </div>
      </form>
      {canDelete && pendingDelete && modal.type === "place" && modal.item && (
        <ConfirmDialog
          confirmation={{
            title: `ลบ “${modal.item.place_name}”?`,
            description:
              "รายการนี้ รวมถึงรายละเอียดและราคาที่บันทึกไว้จะถูกลบออกจาก Timeline",
            confirmLabel: "ลบรายการ",
            onConfirm: async () => {
              await deleteItem(modal.item!);
              setPendingDelete(false);
              close();
            },
          }}
          close={() => setPendingDelete(false)}
        />
      )}{" "}
      {confirmDisableFlights && modal.type === "trip" && modal.trip && (
        <ConfirmDialog
          confirmation={{
            title: "ปิดการเดินทางแบบมีเที่ยวบิน?",
            description:
              "ข้อมูลเที่ยวบิน ผู้โดยสาร รายการ Timeline ค่าใช้จ่ายตั๋ว ข้อมูลประกัน และไฟล์ประกันที่เชื่อมไว้จะถูกลบถาวร",
            confirmLabel: "ปิดและลบข้อมูล",
            onConfirm: () => {
              flightDisableConfirmed.current = true;
              setConfirmDisableFlights(false);
              window.setTimeout(() => formRef.current?.requestSubmit(), 0);
            },
          }}
          close={() => setConfirmDisableFlights(false)}
        />
      )}
      {canDelete && pendingDelete && modal.type === "trip" && modal.trip && (
        <ConfirmDialog
          confirmation={{
            title: `ลบทริป “${modal.trip.name}”?`,
            description:
              "แผนเที่ยว ค่าใช้จ่าย และข้อมูลทั้งหมดในทริปนี้จะถูกลบถาวร",
            confirmLabel: "ลบทริป",
            onConfirm: async () => {
              await deleteTrip(modal.trip!);
              setPendingDelete(false);
              close();
            },
          }}
          close={() => setPendingDelete(false)}
        />
      )}
    </div>
  );
}

export function BNTripApp({
  authenticated = false,
  demo = false,
  storageAdmin = false,
  page = "dashboard",
  tripId,
  returnTo,
  authError,
  workspaceTab,
  tripView,
  accommodationId,
  initialDashboard,
  initialAnalytics,
  initialTrip,
  initialItineraries,
  initialTripCards,
  initialTripFilters = { status: "", type: "", year: "", q: "", sort: "" },
  initialTripDirectory,
}: {
  authenticated?: boolean;
  demo?: boolean;
  storageAdmin?: boolean;
  page?: Screen;
  tripId?: string;
  returnTo?: string;
  authError?: string;
  workspaceTab?: WorkspaceTab;
  tripView?: "flights" | "stays";
  accommodationId?: string;
  initialDashboard?: {
    ongoing: Trip[];
    upcoming: Trip[];
    past: Trip[];
    counts: DashboardCounts;
    countryHighlights: CountryHighlight[];
  };
  initialAnalytics?: TravelAnalyticsCollection;
  initialTrip?: Trip | null;
  initialItineraries?: Itinerary[];
  initialTripCards?: PaymentCard[];
  initialTripFilters?: TripFilters;
  initialTripDirectory?: { items: Trip[]; total: number; years: number[]; hasMore: boolean };
}) {
  const initialDashboardTrips = initialDashboard
    ? applyCachedTripReviewSummaries([
        ...initialDashboard.ongoing,
        ...initialDashboard.upcoming,
        ...initialDashboard.past,
      ])
    : null;
  const initialSelected = tripId
    ? initialTrip || tripListCache?.find((trip) => trip.id === tripId) || null
    : null;
  const cachedSelected = initialSelected
    ? applyCachedTripReviewSummary(initialSelected)
    : null;
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<Lang>("TH");
  const [trips, setTrips] = useState<Trip[]>(() =>
    initialDashboardTrips ||
      (cachedSelected ? [cachedSelected] : tripListCache || []),
  );
  const [selected, setSelected] = useState<Trip | null>(cachedSelected);
  const [itineraries, setItineraries] = useState<Itinerary[]>(() =>
    initialItineraries || (tripId ? itineraryCache.get(tripId) || [] : []),
  );
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [tripCards, setTripCards] = useState<PaymentCard[]>(
    initialTripCards || [],
  );
  const [modal, setModal] = useState<Modal>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(
    (page === "dashboard" && !initialDashboard) ||
      (["trip", "timeline", "expenses"].includes(page) && !cachedSelected),
  );
  const [activeDay, setActiveDay] = useState(1);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts>(
    initialDashboard?.counts || { total: 0, ongoing: 0, upcoming: 0, past: 0 },
  );
  const [dashboardCountryHighlights, setDashboardCountryHighlights] = useState<
    CountryHighlight[]
  >(initialDashboard?.countryHighlights || []);
  const [tripRevision, setTripRevision] = useState(0);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const pullDistanceRef = useRef(0);
  useEffect(() => {
    if (initialDashboard) {
      tripListCache = applyCachedTripReviewSummaries([
        ...initialDashboard.ongoing,
        ...initialDashboard.upcoming,
        ...initialDashboard.past,
      ]);
    }
    if (tripId && initialTrip) {
      const nextInitialTrip = applyCachedTripReviewSummary(initialTrip);
      tripListCache = [
        nextInitialTrip,
        ...(tripListCache || []).filter((trip) => trip.id !== initialTrip.id),
      ];
    }
    if (tripId && initialItineraries)
      itineraryCache.set(tripId, initialItineraries);
  }, [initialDashboard, initialItineraries, initialTrip, tripId]);
  useEffect(() => {
    const syncCachedReviews = () => {
      setTrips((current) => applyCachedTripReviewSummaries(current));
      setSelected((current) =>
        current ? applyCachedTripReviewSummary(current) : current,
      );
    };
    window.addEventListener("pageshow", syncCachedReviews);
    window.addEventListener("popstate", syncCachedReviews);
    syncCachedReviews();
    return () => {
      window.removeEventListener("pageshow", syncCachedReviews);
      window.removeEventListener("popstate", syncCachedReviews);
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setDark(document.documentElement.classList.contains("dark"));
      const saved = localStorage.getItem("bn-lang") as Lang | null;
      if (saved) {
        activeLang = saved;
        setLang(saved);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const message = sessionStorage.getItem(NAVIGATION_TOAST_KEY);
    if (!message) return;
    sessionStorage.removeItem(NAVIGATION_TOAST_KEY);
    const frame = requestAnimationFrame(() => setToast(message));
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    activeLang = lang;
    document.documentElement.lang = lang === "EN" ? "en" : "th";
  }, [lang]);
  useEffect(() => {
    if (!authenticated || page !== "settings") return;
    let active = true;
    fetch("/api/cards")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setCards(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setCards([]);
      });
    return () => {
      active = false;
    };
  }, [authenticated, page]);
  useEffect(() => {
    if (!authenticated || !selected || initialTripCards) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/trips/${selected.id}/cards`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setTripCards(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setTripCards([]);
      });
    return () => controller.abort();
  }, [authenticated, initialTripCards, selected]);
  useEffect(() => {
    if (!authenticated || page === "settings" || page === "trips") return;
    // Server-rendered routes already provide a complete first snapshot. Toggling
    // loading here after hydration briefly replaces that UI with the loading
    // card when navigating back to Home/Plan, which presents as a one-frame
    // flash even though there is nothing left to fetch.
    if (page === "dashboard" && initialDashboard && tripRevision === 0) return;
    if (
      page !== "dashboard" &&
      tripId &&
      initialTrip &&
      tripRevision === 0
    )
      return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        if (page === "dashboard") {
          const response = await fetch("/api/trips?mode=dashboard", {
            signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          const rows: Trip[] = [
            ...(data.ongoing || []),
            ...(data.upcoming || []),
            ...(data.past || []),
          ];
          tripListCache = rows;
          setTrips(rows);
          setDashboardCounts(
            data.counts || {
              total: rows.length,
              ongoing: 0,
              upcoming: 0,
              past: 0,
            },
          );
          setDashboardCountryHighlights(data.countryHighlights || []);
        } else if (tripId) {
          const cached = tripListCache?.find((trip) => trip.id === tripId);
          if (cached) {
            setSelected(cached);
          } else {
            const response = await fetch(`/api/trips/${tripId}`, {
              signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            tripListCache = [
              data,
              ...(tripListCache || []).filter((trip) => trip.id !== data.id),
            ];
            setTrips(tripListCache);
            setSelected(data);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError" && page !== "dashboard")
          setSelected(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [authenticated, initialDashboard, initialTrip, page, tripId, tripRevision]);
  useEffect(() => {
    if (!selected || itineraryCache.has(selected.id)) return;
    let active = true;
    void (async () => {
      const response = await fetch(`/api/trips/${selected.id}/itineraries`);
      const data = await response.json();
      const rows: Itinerary[] = Array.isArray(data) ? data : [];
      itineraryCache.set(selected.id, rows);
      if (active) setItineraries(rows);
    })().catch(() => {
      if (active) setItineraries([]);
    });
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    if (
      page !== "dashboard" ||
      modal ||
      confirmation ||
      refreshingDashboard
    )
      return;
    let startY: number | null = null;
    let pulling = false;
    const updateDistance = (distance: number) => {
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      startY = event.touches[0].clientY;
      pulling = true;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pulling || startY === null || event.touches.length !== 1) return;
      if (window.scrollY > 0) {
        pulling = false;
        startY = null;
        updateDistance(0);
        return;
      }
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        updateDistance(0);
        return;
      }
      event.preventDefault();
      updateDistance(Math.min(92, delta * 0.44));
    };
    const refresh = async () => {
      setRefreshingDashboard(true);
      updateDistance(54);
      try {
        const response = await fetch("/api/trips?mode=dashboard", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Refresh failed");
        const rows: Trip[] = [
          ...(data.ongoing || []),
          ...(data.upcoming || []),
          ...(data.past || []),
        ];
        tripListCache = rows;
        startTransition(() => {
          setTrips(rows);
          setDashboardCounts(
            data.counts || {
              total: rows.length,
              ongoing: 0,
              upcoming: 0,
              past: 0,
            },
          );
          setDashboardCountryHighlights(data.countryHighlights || []);
          setDashboardRefreshToken((value) => value + 1);
        });
        setToast("อัปเดตหน้าแรกแล้ว");
        window.setTimeout(() => setToast(""), 1800);
      } catch {
        setToast("รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง");
        window.setTimeout(() => setToast(""), 2400);
      } finally {
        setRefreshingDashboard(false);
        updateDistance(0);
      }
    };
    const onTouchEnd = () => {
      if (!pulling) return;
      pulling = false;
      startY = null;
      if (pullDistanceRef.current >= 68) void refresh();
      else updateDistance(0);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [confirmation, modal, page, refreshingDashboard]);
  if (!authenticated)
    return (
      <LanguageContext.Provider value={lang}>
        <LoginScreen authError={authError} />
      </LanguageContext.Provider>
    );
  const requireLogin = () => {
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      location.href = "/?authError=demo_login_required";
    });
  };
  const flash = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2400);
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("bn-theme", next ? "dark" : "light");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next ? "#000000" : "#f2f2f7");
  };
  const request = async (url: string, options?: RequestInit) => {
    if (demo && options?.method && options.method !== "GET") {
      requireLogin();
      throw new Error("เข้าสู่ระบบเพื่อเพิ่ม แก้ไข หรือลบข้อมูล");
    }
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      if (data.loginRequired) requireLogin();
      throw new Error(data.error || "บันทึกไม่สำเร็จ");
    }
    return data;
  };
  async function saveModal(data: Record<string, unknown>) {
    if (!modal) return;
    if (modal.type === "trip") {
      const response = await request(
        modal.trip ? `/api/trips/${modal.trip.id}` : "/api/trips",
        {
          method: modal.trip ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const saved: Trip = {
        ...response,
        members: response.members ?? modal.trip?.members ?? [],
      };
      setTrips((old) => {
        const next: Trip[] = modal.trip
          ? old.map((t) => (t.id === saved.id ? saved : t))
          : [saved, ...old];
        const cached = tripListCache || old;
        tripListCache = modal.trip
          ? cached.map((trip) => (trip.id === saved.id ? saved : trip))
          : [saved, ...cached.filter((trip) => trip.id !== saved.id)];
        return next;
      });
      setTripRevision((value) => value + 1);
      if (!modal.trip) itineraryCache.set(saved.id, []);
      else if (data.hasFlights === false) {
        itineraryCache.delete(saved.id);
        invalidateClientResourcesContaining(`trip:${saved.id}:`);
        window.dispatchEvent(
          new CustomEvent("trip-flights-disabled", {
            detail: { tripId: saved.id },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("trip-completion-changed", {
            detail: { tripId: saved.id },
          }),
        );
        router.replace(`/trips/${saved.id}`);
      }
      setSelected(saved);
      flash(
        modal.trip
          ? "แก้ไขทริปแล้ว"
          : "สร้างทริปแล้ว เลือกสิ่งที่ต้องการจัดการได้เลย",
      );
      const origin =
        page === "trips"
          ? `${window.location.pathname}${window.location.search}`
          : returnTo;
      if (!modal.trip)
        router.push(
          `/trips/${saved.id}${origin ? `?returnTo=${encodeURIComponent(origin)}` : ""}`,
        );
    }
    if (modal.type === "place" && selected) {
      const editing = modal.item;
      const saved = await request(
        editing
          ? `/api/itineraries/${editing.id}`
          : `/api/trips/${selected.id}/itineraries`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      setItineraries((old) => {
        const next: Itinerary[] = (
          editing
            ? old.map((item) => (item.id === saved.id ? saved : item))
            : [...old, saved]
        ).sort(
          (a, b) =>
            a.day_number - b.day_number ||
            (a.start_time || "99:99").localeCompare(b.start_time || "99:99"),
        );
        const normalized = withoutFirstTransport(next);
        itineraryCache.set(selected.id, normalized);
        return normalized;
      });
      setActiveDay(saved.day_number);
      flash(
        editing
          ? "อัปเดตวัน เวลา และรายละเอียดแล้ว"
          : modal.duplicateOf
            ? "ทำสำเนาแผนแล้ว"
            : "เพิ่มแผนเที่ยวและเรียง Timeline แล้ว",
      );
    }
  }
  async function removeItinerary(item: Itinerary) {
    await request(`/api/itineraries/${item.id}`, { method: "DELETE" });
    setItineraries((old) => {
      const next = withoutFirstTransport(
        old.filter((row) => row.id !== item.id),
      );
      if (selected) itineraryCache.set(selected.id, next);
      return next;
    });
    flash("ลบรายการออกจาก Timeline แล้ว");
  }
  async function updateItineraryCosts(item: Itinerary, costItems: CostItem[]) {
    const startTime = item.start_time?.slice(0, 5) || "09:00";
    const hour = Number(startTime.slice(0, 2));
    const timeSlot =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const saved = await request(`/api/itineraries/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayNumber: item.day_number,
        timeSlot,
        startTime,
        placeName: item.place_name,
        address: item.address || "",
        transportMode: item.transport_mode || undefined,
        transportNote: item.transport_note || "",
        costItems,
      }),
    });
    setItineraries((old) => {
      const next = withoutFirstTransport(
        old.map((row) => (row.id === saved.id ? saved : row)),
      );
      if (selected) itineraryCache.set(selected.id, next);
      return next;
    });
    return saved as Itinerary;
  }
  async function saveCost(
    source: Itinerary | undefined,
    index: number | undefined,
    target: Itinerary,
    cost: CostItem,
  ) {
    if (source && index !== undefined && source.id !== target.id) {
      await updateItineraryCosts(target, [...(target.cost_items || []), cost]);
      await updateItineraryCosts(
        source,
        (source.cost_items || []).filter((_, costIndex) => costIndex !== index),
      );
    } else {
      const costs = [...(target.cost_items || [])];
      if (index !== undefined) costs[index] = cost;
      else costs.push(cost);
      await updateItineraryCosts(target, costs);
    }
    flash(
      index !== undefined
        ? "แก้ไขค่าใช้จ่ายแล้ว"
        : "เพิ่มค่าใช้จ่ายใน Timeline แล้ว",
    );
  }
  async function deleteCost(item: Itinerary, index: number) {
    await updateItineraryCosts(
      item,
      (item.cost_items || []).filter((_, costIndex) => costIndex !== index),
    );
    flash("ลบค่าใช้จ่ายแล้ว");
  }
  async function removeTrip(trip: Trip) {
    await request(`/api/trips/${trip.id}`, { method: "DELETE" });
    setTrips((old) => {
      const next = old.filter((t) => t.id !== trip.id);
      tripListCache = next;
      return next;
    });
    setTripRevision((value) => value + 1);
    itineraryCache.delete(trip.id);
    if (selected?.id === trip.id) setSelected(null);
    if (page !== "trips") {
      sessionStorage.setItem(NAVIGATION_TOAST_KEY, "ลบทริปสำเร็จแล้ว");
      router.push("/");
    } else {
      flash("ลบทริปสำเร็จแล้ว");
    }
  }
  function confirmLeaveTrip(trip: Trip) {
    setConfirmation({
      title: `ออกจากทริป “${trip.name}”?`,
      description:
        "เมื่อออกแล้ว ทริปนี้จะหายจากรายการของคุณและจะไม่สามารถเปิดหรือแก้ไขได้อีก",
      confirmLabel: "ออกจากทริปนี้",
      busyLabel: "กำลังออกจากทริป…",
      onConfirm: async () => {
        await request(`/api/trips/${trip.id}/collaborators`, {
          method: "DELETE",
        });
        setTrips((old) => {
          const next = old.filter((item) => item.id !== trip.id);
          tripListCache = next;
          return next;
        });
        itineraryCache.delete(trip.id);
        setTripCards([]);
        if (selected?.id === trip.id) setSelected(null);
        setTripRevision((value) => value + 1);
        flash("ออกจากทริปสำเร็จแล้ว");
        router.push(returnTo || "/");
      },
    });
  }
  async function saveCard(
    card: PaymentCard | undefined,
    nickname: string,
    brand: CardBrand,
    lastFour: string,
  ) {
    if (!card) {
      const saved: PaymentCard = await request("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, brand, lastFour }),
      });
      setCards((old) => [saved, ...old]);
      flash("เพิ่มบัตรแล้ว");
      return;
    }
    const oldMethod = cardPaymentLabel(card);
    const saved: PaymentCard = await request(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, brand }),
    });
    const newMethod = cardPaymentLabel(saved);
    setCards((old) => old.map((item) => (item.id === saved.id ? saved : item)));
    if (oldMethod !== newMethod) {
      const remap = (rows: Itinerary[]) =>
        rows.map((item) => ({
          ...item,
          cost_items: (item.cost_items || []).map((cost) =>
            cost.paymentMethod === oldMethod
              ? { ...cost, paymentMethod: newMethod }
              : cost,
          ),
        }));
      setItineraries((old) => {
        const next = remap(old);
        if (selected) itineraryCache.set(selected.id, next);
        return next;
      });
      for (const [tripId, rows] of itineraryCache.entries())
        itineraryCache.set(tripId, remap(rows));
    }
    flash("แก้ไขบัตรแล้ว");
  }
  async function removeCard(card: PaymentCard) {
    await request(`/api/cards/${card.id}`, { method: "DELETE" });
    setCards((old) => old.filter((item) => item.id !== card.id));
    flash("ลบบัตรแล้ว");
  }
  async function reorderCards(nextCards: PaymentCard[]) {
    const previous = cards;
    setCards(nextCards);
    try {
      const saved: PaymentCard[] = await request("/api/cards", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderedIds: nextCards.map((card) => card.id) }),
      });
      setCards(saved);
    } catch (error) {
      setCards(previous);
      throw error;
    }
  }
  async function refreshTripMembers(id: string) {
    const fresh: Trip = await request(`/api/trips/${id}`);
    setSelected((current) => (current?.id === id ? fresh : current));
    setTrips((old) => {
      const next = old.map((trip) => (trip.id === id ? fresh : trip));
      tripListCache = (tripListCache || next).map((trip) =>
        trip.id === id ? fresh : trip,
      );
      return next;
    });
  }
  async function refreshActiveTrip(id: string) {
    const [freshValue, itineraryResponse] = await Promise.all([
      request(`/api/trips/${id}`, { cache: "no-store" }),
      fetch(`/api/trips/${id}/itineraries`, { cache: "no-store" }),
    ]);
    const fresh = freshValue as Trip;
    const itineraryBody = await itineraryResponse.json();
    if (!itineraryResponse.ok)
      throw new Error(itineraryBody.error || "โหลด Timeline ไม่สำเร็จ");
    const rows: Itinerary[] = Array.isArray(itineraryBody)
      ? itineraryBody
      : [];
    setSelected((current) => (current?.id === id ? fresh : current));
    setTrips((old) => {
      const next = old.map((trip) => (trip.id === id ? fresh : trip));
      tripListCache = (tripListCache || next).map((trip) =>
        trip.id === id ? fresh : trip,
      );
      return next;
    });
    itineraryCache.set(id, rows);
    setItineraries(rows);
  }
  function updateTripReviewSummary(id: string, average: number, count: number) {
    tripReviewSummaryCache.set(id, { average, count });
    const update = (trip: Trip) =>
      trip.id === id
        ? { ...trip, review_average: average, review_count: count }
        : trip;
    if (tripListCache) tripListCache = tripListCache.map(update);
    setSelected((current) => (current ? update(current) : current));
    setTrips((old) => old.map(update));
  }
  const selectTrip = (trip: Trip, origin?: string) =>
    router.push(
      `/trips/${trip.id}${origin ? `?returnTo=${encodeURIComponent(origin)}` : ""}`,
    );
  const logout = async () => {
    await clearPrivateOfflineData();
    clearCurrentAccount();
    await fetch("/api/auth/logout", { method: "POST" });
    tripListCache = null;
    itineraryCache.clear();
    location.href = "/";
  };
  const openCost = (item?: Itinerary, index?: number, defaultDay?: number) =>
    setModal({ type: "cost", item, costIndex: index, defaultDay });
  const protect =
    <T extends unknown[]>(action: (...args: T) => void) =>
    (...args: T) => {
      if (demo) {
        requireLogin();
        return;
      }
      action(...args);
    };
  const content = loading ? (
    <div className="card">กำลังโหลดข้อมูล…</div>
  ) : page === "dashboard" ? (
    <Dashboard
      trips={trips}
      counts={dashboardCounts}
      countryHighlights={dashboardCountryHighlights}
      revision={tripRevision + dashboardRefreshToken}
      selectTrip={selectTrip}
      openFlightTrip={(id) => router.push(`/trips/${id}?view=flights`)}
      createTrip={protect(() => setModal({ type: "trip" }))}
      viewAll={(status) =>
        router.push(status === "all" ? "/trips" : `/trips?status=${status}`)
      }
      viewAnalytics={() => router.push("/analytics")}
      onInvitationChanged={() => setTripRevision((value) => value + 1)}
      notify={flash}
      confirmAction={setConfirmation}
    />
  ) : page === "analytics" && initialAnalytics ? (
    <TravelAnalyticsDashboard datasets={initialAnalytics} />
  ) : page === "trips" ? (
    <TripsDirectory
      initialFilters={initialTripFilters}
      initialData={initialTripDirectory}
      revision={tripRevision}
      selectTrip={(trip) =>
        selectTrip(trip, `${window.location.pathname}${window.location.search}`)
      }
      createTrip={protect(() => setModal({ type: "trip" }))}
      refreshEnabled={!modal && !confirmation}
    />
  ) : page === "trip" && selected ? (
    <TripHub
      trip={selected}
      items={itineraries}
      cards={tripCards}
      day={activeDay}
      setDay={setActiveDay}
      back={() => router.push(returnTo || "/")}
      editTrip={protect(() => setModal({ type: "trip", trip: selected }))}
      deleteTrip={protect(() =>
        setConfirmation({
          title: `ลบทริป “${selected.name}”?`,
          description:
            "แผนเที่ยว ค่าใช้จ่าย และข้อมูลทั้งหมดในทริปนี้จะถูกลบถาวร",
          confirmLabel: "ลบทริป",
          onConfirm: () => removeTrip(selected),
        }),
      )}
      openReviews={() => setModal({ type: "reviews", trip: selected })}
      manageCollaborators={protect(() =>
        setModal({ type: "collaborators", trip: selected }),
      )}
      leaveTrip={protect(() =>
        setModal({ type: "collaborators", trip: selected }),
      )}
      addPlace={protect((day) => {
        setActiveDay(day);
        setModal({ type: "place" });
      })}
      editPlace={protect((item) => {
        setActiveDay(item.day_number);
        setModal({ type: "place", item });
      })}
      duplicatePlace={protect((item) => {
        setActiveDay(item.day_number);
        setModal({ type: "place", duplicateOf: item });
      })}
      openCost={protect(openCost)}
      onFlightChanged={async () => {
        const response = await fetch(`/api/trips/${selected.id}/itineraries`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลด Timeline ไม่สำเร็จ");
        const rows: Itinerary[] = Array.isArray(data) ? data : [];
        itineraryCache.set(selected.id, rows);
        setItineraries(rows);
      }}
      notify={flash}
      onRefresh={() => refreshActiveTrip(selected.id)}
      refreshEnabled={!modal && !confirmation}
      initialWorkspaceTab={workspaceTab}
      initialView={tripView}
      initialAccommodationId={accommodationId}
    />
  ) : page === "timeline" && selected ? (
    <TimelineScreen
      trip={selected}
      items={itineraries}
      cards={tripCards}
      day={activeDay}
      setDay={setActiveDay}
      addPlace={protect(() => setModal({ type: "place" }))}
      back={() => router.push(`/trips/${selected.id}`)}
      onRefresh={() => refreshActiveTrip(selected.id)}
      refreshEnabled={!modal && !confirmation}
      notify={flash}
      onChanged={() => refreshActiveTrip(selected.id)}
    />
  ) : page === "expenses" && selected ? (
    <ExpensesScreen
      trip={selected}
      items={itineraries}
      cards={tripCards}
      back={() => router.push(`/trips/${selected.id}`)}
      openCost={protect(openCost)}
    />
  ) : page === "settings" ? (
    <SettingsScreen
      dark={dark}
      toggleTheme={toggleTheme}
      lang={lang}
      setLang={(value) => {
        activeLang = value;
        setLang(value);
        localStorage.setItem("bn-lang", value);
      }}
      logout={logout}
      cards={cards}
      saveCard={saveCard}
      deleteCard={removeCard}
      reorderCards={reorderCards}
      clearAllOfflineDocuments={() =>
        setConfirmation({
          title: "เคลียร์เอกสารออฟไลน์ทั้งหมด?",
          description:
            "เอกสารที่ดาวน์โหลดไว้จากทุกทริปจะถูกลบออกจากอุปกรณ์นี้ แต่ไฟล์ต้นฉบับบนระบบจะไม่ถูกลบ",
          confirmLabel: "เคลียร์ทั้งหมด",
          busyLabel: "กำลังเคลียร์…",
          onConfirm: async () => {
            await clearOfflineDocuments();
            flash("เคลียร์เอกสารออฟไลน์ทั้งหมดแล้ว");
          },
        })
      }
      demo={demo}
      demoAction={requireLogin}
      storageAdmin={storageAdmin}
    />
  ) : (
    <EmptyState
      title="ไม่พบทริปนี้"
      description="ทริปอาจถูกลบหรือไม่ได้อยู่ในบัญชีนี้"
      action="กลับไปเลือกทริป"
      onClick={() => router.push("/")}
    />
  );
  const modalContent = !modal ? null : modal.type === "reviews" ? (
    <ReviewsSheet
      trip={modal.trip}
      close={() => setModal(null)}
      notify={flash}
      loginRequired={requireLogin}
      onSaved={(average, count) =>
        updateTripReviewSummary(modal.trip.id, average, count)
      }
    />
  ) : modal.type === "collaborators" ? (
    <CollaboratorsSheet
      trip={modal.trip}
      close={() => setModal(null)}
      onChanged={() => void refreshTripMembers(modal.trip.id)}
      confirmRemove={setConfirmation}
      notify={flash}
      requestLeave={() => {
        setModal(null);
        confirmLeaveTrip(modal.trip);
      }}
    />
  ) : modal.type === "cost" ? (
    selected ? (
      <CostSheet
        modal={modal}
        trip={selected}
        items={itineraries}
        cards={tripCards}
        close={() => setModal(null)}
        saveCost={saveCost}
        deleteCost={deleteCost}
        canDelete={selected.access_role !== "view"}
      />
    ) : null
  ) : (
    <ModalForm
      modal={modal}
      trip={selected}
      day={activeDay}
      items={itineraries}
      close={() => setModal(null)}
      submit={saveModal}
      deleteItem={removeItinerary}
      deleteTrip={removeTrip}
      canDelete={selected?.access_role !== "view"}
    />
  );
  const label = (value: string) =>
    lang === "EN" ? translateUiText(value) : value;
  return (
    <LanguageContext.Provider value={lang}>
      <div
        className={`app-shell flow-shell ${page === "trip" || page === "expenses" ? "trip-page-shell" : ""} ${demo ? "demo-mode" : ""}`}
      >
        {toast && (
          <div className="toast toast-success" role="status">
            <CheckCircle2 size={17} />
            {lang === "EN" ? translateUiText(toast) : toast}
          </div>
        )}
        <main>
          <header className="mobile-head flow-header">
            <Brand />
            <nav
              className="mobile-actions"
              aria-label={lang === "EN" ? "Main menu" : "เมนูหลัก"}
            >
              {page !== "dashboard" && (
                <button
                  className="icon-btn"
                  onClick={() => router.push("/")}
                  aria-label={lang === "EN" ? "Home" : "หน้าแรก"}
                  title={lang === "EN" ? "Home" : "หน้าแรก"}
                >
                  <House size={18} />
                </button>
              )}
              <button
                className={`icon-btn ${page === "settings" ? "active" : ""}`}
                onClick={() => router.push("/settings")}
                aria-label={lang === "EN" ? "Settings" : "ตั้งค่า"}
                title={lang === "EN" ? "Settings" : "ตั้งค่า"}
              >
                <Settings2 size={18} />
              </button>
            </nav>
          </header>
          {demo && (
            <aside className="demo-banner" role="status">
              <div>
                <Sparkles size={16} />
                <span>
                  <strong>{label("กำลังทดลองใช้งาน")}</strong>
                  <small>
                    {label(
                      "ดูข้อมูลได้เต็มที่ · การเพิ่ม แก้ไข และลบ ต้องเข้าสู่ระบบ",
                    )}
                  </small>
                </span>
              </div>
              <button type="button" onClick={requireLogin}>
                {label("เข้าสู่ระบบ")}
                <ArrowRight size={14} />
              </button>
            </aside>
          )}
          {page === "dashboard" && (
            <div
              className={`pull-refresh-indicator ${refreshingDashboard ? "is-refreshing" : ""} ${pullDistance >= 68 ? "is-ready" : ""}`}
              style={{
                opacity: refreshingDashboard
                  ? 1
                  : Math.min(1, pullDistance / 42),
                transform: `translate3d(-50%, ${Math.max(-48, pullDistance - 48)}px, 0)`,
              }}
              role="status"
              aria-live="polite"
            >
              <RefreshCw size={17} />
              <span>
                {label(
                  refreshingDashboard
                    ? "กำลังอัปเดต…"
                    : pullDistance >= 68
                      ? "ปล่อยเพื่อรีเฟรช"
                      : "ดึงลงเพื่อรีเฟรช",
                )}
              </span>
            </div>
          )}
          <div
            className={`route-content ${page === "dashboard" ? "dashboard-pull-content" : ""} ${page === "dashboard" && pullDistance > 0 && !refreshingDashboard ? "is-pulling" : ""}`}
            style={
              page === "dashboard" && pullDistance > 0
                ? { transform: `translate3d(0, ${pullDistance}px, 0)` }
                : undefined
            }
          >
            {content}
          </div>
        </main>
        {modalContent}
        {confirmation && (
          <ConfirmDialog
            confirmation={confirmation}
            close={() => setConfirmation(null)}
          />
        )}
      </div>
    </LanguageContext.Provider>
  );
}
