"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { LiquiGlass } from "@liqui-design/glass";
import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageIntro } from "@/src/components/page-intro";
import { TripSectionHeading } from "@/src/components/trip-section-heading";
import { DocumentFilePicker } from "@/src/components/document-file-picker";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { InvitationNotifications } from "@/src/components/invitation-notifications";
import type {
  CountryHighlight,
  FavoriteAccommodation,
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
import { optimizedCanvasFile, prepareDocumentFile } from "@/src/lib/client-image-compression";
import { uploadPrivateDocument } from "@/src/lib/client-blob-upload";
import {
  invalidateClientResourcesContaining,
} from "@/src/lib/client-resource-cache";
import {
  TRIP_COUNTRIES,
  countryByCode,
  formatTripDestination,
  inferTripCountry,
} from "@/src/lib/countries";
import {
  createCustomTripDestination,
  TRIP_DESTINATION_OPTIONS,
  type TripDestinationOption,
  type TripDestinationSelection,
} from "@/src/lib/travel-badges";
import { bookingPlatformByValue } from "@/src/lib/booking-platforms";
import { FlightPassengerInfoList } from "@/src/components/flight-passenger-info";
import { AirlineLogo } from "@/src/components/airline-logo";
import { flightDurationLabel } from "@/src/lib/flight-display";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BedDouble,
  Bell,
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
  Crown,
  Database,
  Download,
  FolderOpen,
  FileText,
  Footprints,
  Gem,
  Globe2,
  ImagePlus,
  Images,
  GripVertical,
  Heart,
  House,
  LocateFixed,
  LogOut,
  Luggage,
  Map as MapIcon,
  MapPin,
  Menu,
  Minus,
  Moon,
  Navigation,
  Pencil,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Ship,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Telescope,
  Ticket,
  TrainFront,
  Trash2,
  UserRound,
  UserPlus,
  Utensils,
  WalletCards,
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
const TripInsurance = dynamic(
  () => import("@/src/components/trip-flights").then((module) => module.TripFlights),
  { loading: () => <div className="card">กำลังเปิดข้อมูลประกัน…</div> },
);
const TripAccommodations = dynamic(
  () => import("@/src/components/trip-accommodations").then((module) => module.TripAccommodations),
  { loading: () => <div className="card">กำลังเปิดข้อมูลที่พัก…</div> },
);

type Screen =
  | "dashboard"
  | "album"
  | "analytics"
  | "trips"
  | "trip"
  | "timeline"
  | "expenses"
  | "settings";
type WorkspaceTab = "checklist" | "documents";
type Lang = "TH" | "EN";
type TripStatus = "all" | "ongoing" | "upcoming" | "past";
type TripType = "all" | "domestic" | "international";
type TripFilters = {
  status: string;
  type: string;
  year: string;
  q: string;
  sort: string;
  focus: string;
  loaded: string;
};
export type DashboardCounts = {
  total: number;
  ongoing: number;
  upcoming: number;
  past: number;
  countries?: number;
  destinations?: number;
  travel_days?: number;
  badges_unlocked?: number;
  badges_total?: number;
};
type AccountProfile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
};
type TripInvitation = {
  id: string;
  invitation_type: "trip" | "trip_idea";
  trip_id: string | null;
  trip_idea_id: string | null;
  email: string;
  created_at: string;
  trip_name: string;
  destination: string;
  cover_image_url: string | null;
  outbound_departure_at: string | null;
  return_departure_at: string | null;
  total_days: number | null;
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
type ExpenseGuest = {
  id: string;
  name: string;
};
export type Trip = {
  id: string;
  name: string;
  destination: string;
  country_code?: string | null;
  country_name?: string | null;
  trip_destinations?: TripDestinationSelection[];
  start_date: string;
  total_days: number;
  traveller_count?: number;
  budget_thb: string;
  shopping_budget_thb: string;
  actual_spent_thb?: number | string;
  outbound_departure_at: string | null;
  return_departure_at: string | null;
  cover_image_url: string | null;
  summary_image_url?: string | null;
  google_photos_url: string | null;
  timezone?: string;
  has_flights?: boolean;
  flight_summaries?: Array<{
    journey_type: "outbound" | "return" | "internal";
    segment_order: number;
    airline_code: string;
    flight_number: string;
  }>;
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
  splitGuestIds?: string[];
  splitCount?: number;
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
  accommodation_booking_platform?: string | null;
  accommodation_image_url?: string | null;
  location_image_url?: string | null;
};
type Modal =
  | { type: "trip"; trip?: Trip; preset?: TripCreationPreset }
  | {
      type: "place";
      item?: Itinerary;
      defaultDay?: number;
      defaultTime?: string;
    }
  | {
      type: "cost";
      item?: Itinerary;
      costIndex?: number;
      defaultDay?: number;
      returnToExpenseList?: () => void;
    }
  | { type: "collaborators"; trip: Trip }
  | { type: "reviews"; trip: Trip }
  | null;
export type Confirmation = {
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
export type TripCreationPreset = {
  sourceIdeaId: string;
  destination: string;
  countryCode?: string;
  locationIds?: string[];
  tripDestinations?: TripDestinationOption[];
  coverImageUrl: string;
  outboundDate: string;
  outboundTime: string;
};
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
      key={src}
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
  แผนเที่ยวทุกทริป: "Trip plans",
  อัปเดตหน้ารวมทริปแล้ว: "Trips updated",
  คัดลอกลิงก์แล้ว: "Link copied",
  แชร์: "Share",
  เมนูทริป: "Trip menu",
  เลือกข้อมูลทริป: "Choose trip section",
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
  "ทริปที่เล็งไว้": "Trips on the radar",
  เล็งไว้: "Radar",
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
  เพิ่มสถานที่ระหว่างจุด: "Add place between stops",
  เพิ่มสถานที่ถัดไป: "Add next place",
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
  งบประมาณรวม: "Total budget",
  ใช้ไป: "Spent",
  ใช้ไปแล้ว: "Spent",
  เกินงบ: "Over budget",
  คงเหลือ: "Remaining",
  ยังอยู่ในงบประมาณ: "Within budget",
  งบแยกประเภท: "Budget breakdown",
  ภาพรวมค่าใช้จ่าย: "Expense overview",
  ดูรายละเอียด: "View details",
  ย่อ: "Collapse",
  ขยาย: "Expand",
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
  กดเพื่อแสดงทั้งหมด: "Tap to show all",
  ยังไม่มีค่าใช้จ่าย: "No expenses yet",
  สรุปค่าใช้จ่ายจากแพลน: "Plan expense summary",
  ยอดรวมแปลงเป็นเงินบาทด้วยเรตของวันที่บันทึก:
    "Totals are converted to THB using the saved date's rate",
  เพิ่มค่าใช้จ่าย: "Add expense",
  กลับด้านบน: "Back to top",
  "ต้องเพิ่ม Timeline ก่อน": "Add a Timeline item first",
  "วันนี้ยังไม่มี Timeline": "No Timeline items today",
  ยังไม่มีราคาที่กรอกในวันนี้: "No expenses recorded today",
  วันนี้ไม่มีค่าใช้จ่ายหมวด: "No expenses in this category today:",
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
  เลือกวัน: "Choose day",
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
  ดูทริปทั้งหมดใน: "View all trips in",
  กรองสถิติการเดินทาง: "Filter travel insights",
  ภายในประเทศ: "Domestic",
  ต่างประเทศ: "International",
  "ภาพรวมจากทริปที่ผ่านมาแล้วเท่านั้น":
    "An overview of completed trips only",
  ทริปที่ผ่านมา: "Past trips",
  ประเทศที่เคยไป: "Countries visited",
  จังหวัดที่เคยไป: "Destinations visited",
  จังหวัดและจำนวนทริป: "Destinations and trip counts",
  เรียงจากจุดหมายที่ไปบ่อยที่สุด: "Sorted by most visited destination",
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
  ค้นหาประเทศ: "Search countries",
  "ไม่พบประเทศในรายการ": "No countries found",
  "พิมพ์ชื่อประเทศเพื่อค้นหา แล้วเลือกจากรายการ":
    "Type a country name, then choose from the list",
  "เลือกประเทศก่อน แล้วจึงค้นหาเมืองด้านล่าง":
    "Choose a country, then search for a city below",
  เวลาอัตโนมัติ: "Automatic timezone",
  เรื่องราวการเดินทางของคุณ: "Your travel story",
  เรื่องราวการเดินทาง: "Travel stories",
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
  "วันและเวลานี้มีแผนอยู่แล้ว กรุณาเลือกเวลาอื่น":
    "A plan already exists at this date and time. Choose another time.",
});
Object.assign(EN_TEXT, {
  เตรียมทริป: "Trip prep",
  Checklist: "Checklist",
  เอกสาร: "Documents",
  "เอกสารของทริป": "Trip documents",
  "เตรียมสิ่งที่ต้องทำและของที่ต้องใช้ให้พร้อมก่อนเดินทาง":
    "Prepare every task and essential before departure",
  "รวมเอกสารสำคัญของทริปไว้ในที่เดียว":
    "Keep all important trip documents in one place",
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
  "อัปเดตสถิติล่าสุดแล้ว": "Statistics updated",
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
  ความทรงจำของเรา: "Our memories",
  วันแห่งการเดินทาง: "Travel days",
  "ออกไปเก็บความทรงจำดีๆ ด้วยกันอีกนะ": "Let's make more good memories together",
  เปิดเข็มกลัดท่องเที่ยว: "Open travel badges",
  สะสมแล้ว: "Collected",
  "ออกเดินทางต่อไป เก็บให้ครบทุกที่เลย!": "Keep traveling and collect them all!",
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
type DashboardSnapshot = {
  trips: Trip[];
  favoriteAccommodations: FavoriteAccommodation[];
  counts: DashboardCounts;
  countryHighlights: CountryHighlight[];
};
let dashboardSnapshotCache: DashboardSnapshot | null = null;
let tripInvitationsCache: TripInvitation[] | null = null;
let nearbyFlightsCache: {
  flights: NearbyFlight[];
  syncConfigured: boolean;
} | null = null;
function cacheNearbyFlights(
  flights: NearbyFlight[],
  syncConfigured: boolean,
) {
  nearbyFlightsCache = { flights, syncConfigured };
}
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

async function fetchFreshDashboardSnapshot(): Promise<DashboardSnapshot> {
  const response = await fetch("/api/trips?mode=dashboard", {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Refresh failed");
  const trips: Trip[] = [
    ...(data.ongoing || []),
    ...(data.upcoming || []),
    ...(data.past || []),
  ];
  const snapshot: DashboardSnapshot = {
    trips,
    favoriteAccommodations: data.favoriteAccommodations || [],
    counts: data.counts || {
      total: trips.length,
      ongoing: 0,
      upcoming: 0,
      past: 0,
    },
    countryHighlights: data.countryHighlights || [],
  };
  tripListCache = trips;
  dashboardSnapshotCache = snapshot;
  return snapshot;
}
const itineraryCache = new Map<string, Itinerary[]>();
const COUNTRY_FLAG_ASSET_CODES = new Set([
  "AE", "AU", "CA", "CH", "CN", "DE", "ES", "FR", "GB", "HK", "ID", "IN", "IT", "JP", "KH", "KR", "LA", "MM", "MY", "NZ", "PH", "SG", "TH", "TW", "US", "VN",
]);

export function CountryFlagImage({
  code,
  label,
  className = "",
}: {
  code: string;
  label: string;
  className?: string;
}) {
  const normalizedCode = code.toUpperCase();
  if (!COUNTRY_FLAG_ASSET_CODES.has(normalizedCode)) {
    return (
      <span
        className={`country-flag-image country-flag-emoji ${className}`.trim()}
        role="img"
        aria-label={label || countryByCode(normalizedCode)?.nameTh || normalizedCode}
      >
        {countryByCode(normalizedCode)?.flag || "🌍"}
      </span>
    );
  }
  return (
    <Image
      className={`country-flag-image ${className}`.trim()}
      src={`/flags/${normalizedCode.toLowerCase()}.svg`}
      alt={label}
      width={64}
      height={64}
      loading="eager"
      decoding="sync"
      unoptimized
      draggable={false}
    />
  );
}

export function CountryPicker({
  value,
  onChange,
  note,
  name = "countryCode",
}: {
  value: string;
  onChange: (countryCode: string) => void;
  note?: ReactNode;
  name?: string;
}) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const listboxId = useId();
  const selected = countryByCode(value) || TRIP_COUNTRIES[0];
  const selectedLabel = lang === "EN" ? selected.nameEn : selected.nameTh;
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedCodeRef = useRef(selected.code);
  const blurTimerRef = useRef<number | null>(null);
  useEffect(() => {
    selectedCodeRef.current = selected.code;
  }, [selected.code]);
  useEffect(
    () => () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    },
    [],
  );
  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = TRIP_COUNTRIES.filter((country) => {
      if (!normalized) return true;
      return [country.code, country.nameTh, country.nameEn, ...(country.aliases || [])]
        .some((term) => term.toLowerCase().includes(normalized));
    });
    return filtered
      .sort((a, b) => Number(b.code === selected.code) - Number(a.code === selected.code))
      .slice(0, 20);
  }, [query, selected.code]);

  function selectCountry(code: string) {
    const country = countryByCode(code);
    if (!country) return;
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    selectedCodeRef.current = country.code;
    onChange(country.code);
    setQuery(lang === "EN" ? country.nameEn : country.nameTh);
    setActiveIndex(0);
    setOpen(false);
  }

  return (
    <div className="field country-select-field country-picker">
      <label>{t("ประเทศ")}</label>
      <input type="hidden" name={name} value={selected.code} />
      <div className="country-picker-control">
        <CountryFlagImage code={selected.code} label="" className="country-picker-flag" />
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          placeholder={t("ค้นหาประเทศ")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          onFocus={(event) => {
            if (blurTimerRef.current !== null) {
              window.clearTimeout(blurTimerRef.current);
              blurTimerRef.current = null;
            }
            setOpen(true);
            setActiveIndex(0);
            if (query === selectedLabel) {
              setQuery("");
              window.setTimeout(() => event.currentTarget.select(), 0);
            }
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => {
              const latestCountry =
                countryByCode(selectedCodeRef.current) || TRIP_COUNTRIES[0];
              setOpen(false);
              setQuery(
                lang === "EN" ? latestCountry.nameEn : latestCountry.nameTh,
              );
              setActiveIndex(0);
              blurTimerRef.current = null;
            }, 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              if (options.length) {
                setActiveIndex((current) => Math.min(current + 1, options.length - 1));
              }
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && open && options[activeIndex]) {
              event.preventDefault();
              selectCountry(options[activeIndex].code);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery(selectedLabel);
              event.currentTarget.blur();
            }
          }}
        />
        <ChevronDown size={15} aria-hidden="true" />
      </div>
      {open && (
        <div id={listboxId} className="trip-destination-options country-picker-options" role="listbox">
          {options.length ? options.map((country, index) => (
            <button
              type="button"
              role="option"
              aria-selected={country.code === selected.code}
              className={index === activeIndex ? "is-active" : ""}
              key={country.code}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectCountry(country.code)}
            >
              <CountryFlagImage code={country.code} label="" />
              <span>
                <strong>{lang === "EN" ? country.nameEn : country.nameTh}</strong>
                <small>{lang === "EN" ? country.nameTh : country.nameEn} · {country.code}</small>
              </span>
              {country.code === selected.code ? <CheckCircle2 size={15} /> : null}
            </button>
          )) : <p>{t("ไม่พบประเทศในรายการ")}</p>}
        </div>
      )}
      <small>{note || t("พิมพ์ชื่อประเทศเพื่อค้นหา แล้วเลือกจากรายการ")}</small>
    </div>
  );
}

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
      <CountryFlagImage code={country.code} label="" />
    </span>
  );
}

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="RouteRao · หน้าแรก">
      <Image
        src="/routerao-logo-transparent-512.png"
        alt="RouteRao"
        width={48}
        height={48}
        priority
        unoptimized
      />
      <div>
        RouteRao<small>travel smarter together</small>
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
  const label = (profile?.display_name || profile?.email || "RouteRao").trim();
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
  variant?: "cover" | "compact" | "header" | "inline";
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
      {variant !== "inline" && <small>({count})</small>}
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
function tripDateRangeLabel(trip: Trip) {
  const label = (value: string | null) => {
    if (!value) return "";
    const date = value.slice(0, 10);
    return new Date(`${date}T00:00:00`).toLocaleDateString(
      activeLang === "EN" ? "en-GB" : "th-TH",
      { day: "numeric", month: "short", year: "2-digit" },
    );
  };
  return [
    label(trip.outbound_departure_at),
    label(trip.return_departure_at),
  ]
    .filter(Boolean)
    .join(" - ");
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

function costSplitCount(cost: CostItem, fallback = 1) {
  if (Array.isArray(cost.splitGuestIds)) {
    return Math.max(
      1,
      (cost.splitMemberIds?.length || 0) + cost.splitGuestIds.length,
    );
  }
  const saved = Number(cost.splitCount);
  if (Number.isInteger(saved) && saved >= 1 && saved <= 100) return saved;
  const selectedMembers = cost.splitMemberIds?.length || 0;
  if (selectedMembers) return selectedMembers;
  return Math.min(100, Math.max(1, Math.floor(Number(fallback) || 1)));
}

const EXPENSE_GUESTS_CHANGED_EVENT = "bn-trip:expense-guests-changed";

function useExpenseGuests(tripId: string) {
  const [guests, setGuests] = useState<ExpenseGuest[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/expense-guests`);
        const data = await response.json();
        if (active && response.ok && Array.isArray(data)) setGuests(data);
      } catch {
        // The cost form stays usable for joined members if guest loading fails.
      }
    };
    void load();
    const onChanged = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail
        ?.tripId;
      if (!changedTripId || changedTripId === tripId) void load();
    };
    window.addEventListener(EXPENSE_GUESTS_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(EXPENSE_GUESTS_CHANGED_EVENT, onChanged);
    };
  }, [tripId]);
  return { guests, setGuests };
}

function costSplitLabel(cost: CostItem, fallback = 1) {
  const count = costSplitCount(cost, fallback);
  if (count <= 1) return "";
  return `หาร ${count} คน · ฿${bahtFormat(Number(cost.value || 0) / count)}/คน`;
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
  if (minutes === null) return "09:00";
  const next = Math.min(minutes + 60, 23 * 60 + 59);
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
function timeFromMinutes(minutes: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
function itineraryPlanTime(item: Itinerary) {
  return item.start_time?.slice(0, 5) || (item.accommodation_id ? "23:30" : null);
}
function insertionPlanTime(previous: Itinerary, next?: Itinerary) {
  const previousMinutes = timeInMinutes(itineraryPlanTime(previous));
  if (previousMinutes === null) return "09:00";
  if (!next) return shiftedPlanTime(itineraryPlanTime(previous));
  const nextMinutes = timeInMinutes(itineraryPlanTime(next));
  if (nextMinutes === null || nextMinutes <= previousMinutes + 1) {
    return timeFromMinutes(previousMinutes + 10);
  }
  for (const increment of [60, 30, 10]) {
    if (previousMinutes + increment < nextMinutes) {
      return timeFromMinutes(previousMinutes + increment);
    }
  }
  return timeFromMinutes(previousMinutes + Math.floor((nextMinutes - previousMinutes) / 2));
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
  manageCollaborators,
  priority = false,
}: {
  trip: Trip;
  past?: boolean;
  now: number;
  selectTrip: (t: Trip) => void;
  manageCollaborators: (trip: Trip) => void;
  priority?: boolean;
}) {
  const t = useT();
  const coverUrl = trip.cover_image_url || DEFAULT_TRIP_COVER;
  const temporal = tripTemporalStatus(trip, now);
  const budget = Number(trip.budget_thb || 0);
  const actualSpent = Number(trip.actual_spent_thb || 0);
  const ongoing = temporal.ongoing;
  const destinationLabel = formatTripDestination(
    trip.destination,
    trip.country_code,
    trip.country_name,
    trip.trip_destinations,
  );
  const dateRangeLabel = tripDateRangeLabel(trip);
  const hasDuration = Number(trip.total_days || 0) > 0;
  const flightSummaries = (trip.flight_summaries || []).filter(
    (flight) => flight.airline_code && flight.flight_number,
  );
  const flightTypeCounts = flightSummaries.reduce((counts, flight) => {
    counts.set(flight.journey_type, (counts.get(flight.journey_type) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const flightTypeIndexes = new Map<string, number>();
  const flightLabels = flightSummaries.map((flight) => {
    const index = flightTypeIndexes.get(flight.journey_type) || 0;
    flightTypeIndexes.set(flight.journey_type, index + 1);
    const baseLabel =
      flight.journey_type === "outbound"
        ? "ขาไป"
        : flight.journey_type === "return"
          ? "ขากลับ"
          : "ระหว่างทริป";
    return {
      key: `${flight.journey_type}-${flight.segment_order}-${flight.airline_code}-${flight.flight_number}`,
      label:
        (flightTypeCounts.get(flight.journey_type) || 0) > 1
          ? `${baseLabel} ${index + 1}`
          : baseLabel,
      number: `${flight.airline_code} ${flight.flight_number}`,
      showIcon: index === 0,
      direction:
        flight.journey_type === "return" ? "return" : "outbound",
    };
  });
  const hasBudget = budget > 0 || actualSpent > 0;
  const countdownLabel = !trip.outbound_departure_at
    ? t("ยังไม่กำหนดวัน")
    : ongoing
      ? t("กำลังเดินทาง")
      : t(`อีก ${temporal.daysUntil} วัน`);
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
        {!past && (
          <b
            className={`countdown-badge ${ongoing ? "ongoing-badge" : "upcoming-badge"}`}
          >
            <CalendarDays size={12} />
            <span>{countdownLabel}</span>
          </b>
        )}
        {past && <TripRatingBadge trip={trip} variant="cover" />}
        <SharedTripAvatars
          members={trip.members}
          limit={3}
          onClick={() => manageCollaborators(trip)}
          actionLabel={t("ผู้ร่วมทริป")}
        />
      </div>
      <div className="trip-body">
        <h3>{trip.name}</h3>
        {destinationLabel && (
          <p>
            <TripCountryFlag trip={trip} />
            {destinationLabel}
          </p>
        )}
        {(dateRangeLabel || hasDuration) && (
          <div className="trip-card-facts">
            {dateRangeLabel && (
              <span>
                <CalendarDays size={11} />
                {dateRangeLabel}
              </span>
            )}
            {dateRangeLabel && hasDuration && (
              <i className="trip-card-facts-separator" aria-hidden="true">
                •
              </i>
            )}
            {hasDuration && (
              <span>
                <Moon size={11} fill="currentColor" />
                {t(`${trip.total_days} วัน`)}
              </span>
            )}
          </div>
        )}
        {flightLabels.length > 0 && (
          <div className="trip-card-flights">
            {flightLabels.map((flight) => (
              <span className="trip-card-flight" key={flight.key}>
                <i aria-hidden="true">
                  {flight.showIcon && (
                    <Plane
                      className={`trip-card-flight-plane is-${flight.direction}`}
                      size={12}
                      fill="currentColor"
                    />
                  )}
                </i>
                <span>
                  <b>{t(flight.label)} :</b> {flight.number}
                </span>
              </span>
            ))}
          </div>
        )}
        {hasBudget && (
          <div className="trip-meta">
            {budget > 0 && (
              <span>{t("งบ")} ฿{budget.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
            )}
            {actualSpent > 0 && (
              <span className={actualSpent > budget && budget > 0 ? "is-over-budget" : "is-actual-spent"}>
                {t("ใช้จริง")} ฿{actualSpent.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
        )}
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
  const [items, setItems] = useState<TripInvitation[]>(
    () => tripInvitationsCache || [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    if (revision === 0 && tripInvitationsCache !== null) return;
    let active = true;
    fetch("/api/invitations")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          const rows = Array.isArray(data) ? data : [];
          tripInvitationsCache = rows;
          setItems(rows);
        }
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
      setItems((current) => {
        const next = current.filter((item) => item.id !== invitation.id);
        tripInvitationsCache = next;
        return next;
      });
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
    setItems((current) => {
      const next = current.filter((item) => item.id !== invitation.id);
      tripInvitationsCache = next;
      return next;
    });
    notify("ปฏิเสธคำเชิญแล้ว");
  }
  function askDecline(invitation: TripInvitation) {
    confirmAction({
      title: `ปฏิเสธคำเชิญ “${invitation.trip_name}”?`,
      description:
        invitation.invitation_type === "trip_idea"
          ? "คำเชิญนี้จะถูกลบออก และทริปที่เล็งไว้จะไม่ถูกเพิ่มในรายการของคุณ"
          : "คำเชิญนี้จะถูกลบออก และทริปจะไม่ถูกเพิ่มในรายการของคุณ",
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
                    {invitation.invitation_type === "trip_idea"
                      ? "เชิญคุณร่วมวางแผนทริปที่เล็งไว้"
                      : t("เชิญคุณเข้าร่วมทริป")}
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

function FlightSnapshotCard({
  flight,
  now,
  openFlightTrip,
  onSync,
  syncing = false,
  syncDisabled = false,
  featured = false,
}: {
  flight: NearbyFlight;
  now: number;
  openFlightTrip: (tripId: string) => void;
  onSync?: (flight: NearbyFlight) => void;
  syncing?: boolean;
  syncDisabled?: boolean;
  featured?: boolean;
}) {
  const t = useT();
  const departure = new Date(flight.latest_departure_at || flight.scheduled_departure_at);
  const arrival = new Date(flight.latest_arrival_at || flight.scheduled_arrival_at);
  const isActive = departure.getTime() <= now && now <= arrival.getTime();
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
  const duration = flightDurationLabel({
    scheduledDepartureAt: flight.scheduled_departure_at,
    scheduledArrivalAt: flight.scheduled_arrival_at,
    enteredDepartureLocalText: flight.entered_departure_local_text,
    enteredArrivalLocalText: flight.entered_arrival_local_text,
    latestDepartureAt: flight.latest_departure_at,
    latestArrivalAt: flight.latest_arrival_at,
  });
  return (
    <article
      className={`flight-card flight-card-compact nearby-flight-card nearby-flight-card-full${featured ? " is-featured-flight" : ""}`}
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
          <AirlineLogo code={flight.airline_code} name={flight.airline_name} />
          <div className="flight-number">
            <span>{flight.airline_name || flight.airline_code}</span>
            <strong>{flight.airline_code} {flight.flight_number}</strong>
          </div>
        </div>
        <div className="nearby-flight-head-badges">
          <div className="nearby-flight-status-stack">
            <span className={`flight-status status-${flight.status.toLowerCase().replace(/\s/g, "-")}`}>{isActive ? t("กำลังบิน") : flight.status || "scheduled"}</span>
            <b>{isActive ? t("กำลังเดินทาง") : hasEnded ? t("เดินทางแล้ว") : hours < 24 ? t(`อีก ${hours} ชม.`) : t(`อีก ${Math.ceil(hours / 24)} วัน`)}</b>
          </div>
          {onSync && !hasEnded && <button type="button" className={`icon-btn nearby-flight-sync ${syncing ? "is-syncing" : ""}`} disabled={syncDisabled} onClick={(event) => { event.stopPropagation(); onSync(flight); }} aria-label={t("อัปเดตข้อมูลเที่ยวบินทันที")}><RefreshCw size={15} /></button>}
        </div>
      </div>
      <div className="flight-route-compact">
        <div className="flight-airport-block">
          <span className="flight-route-label">{t("ต้นทาง")}</span>
          <strong>{flight.departure_airport_code}</strong>
          <em>{flight.departure_airport_name ? airportName(flight.departure_airport_name) : t("รอข้อมูลสนามบิน")}</em>
          <b>{departureTime}</b>
        </div>
        <div className="flight-route-path"><small className="flight-route-date"><CalendarDays size={10}/><span>{departureDay.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span><i>→</i><span>{arrivalDay.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span></small><div className="flight-route-track"><span /><Plane size={23} /><span /></div><small className="flight-duration-label">{duration}</small></div>
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
}

function NearbyFlights({
  openFlightTrip,
  notify,
  revision,
  onActiveFlightChange,
}: {
  openFlightTrip: (tripId: string) => void;
  notify: (message: string) => void;
  revision: number;
  onActiveFlightChange: (flight: NearbyFlight | null) => void;
}) {
  const t = useT();
  const [flights, setFlights] = useState<NearbyFlight[]>(
    () => nearbyFlightsCache?.flights || [],
  );
  const [loading, setLoading] = useState(nearbyFlightsCache === null);
  const [syncConfigured, setSyncConfigured] = useState(
    () => nearbyFlightsCache?.syncConfigured || false,
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const now = useMinuteClock().getTime();
  const activeFlight = useMemo(() => flights.find((flight) => {
    const departure = new Date(flight.latest_departure_at || flight.scheduled_departure_at).getTime();
    const arrival = new Date(flight.latest_arrival_at || flight.scheduled_arrival_at).getTime();
    return departure <= now && now <= arrival;
  }) || null, [flights, now]);
  const visibleFlights = useMemo(
    () => flights.filter((flight) => flight.id !== activeFlight?.id),
    [activeFlight?.id, flights],
  );
  useEffect(() => {
    onActiveFlightChange(activeFlight);
  }, [activeFlight, onActiveFlightChange]);
  useEffect(() => {
    let active = true;
    const apply = (body: { flights?: NearbyFlight[]; syncConfigured?: boolean }) => {
      if (!active) return;
      const nextFlights = Array.isArray(body.flights)
        ? body.flights
        : nearbyFlightsCache?.flights || [];
      const nextSyncConfigured =
        typeof body.syncConfigured === "boolean"
          ? body.syncConfigured
          : nearbyFlightsCache?.syncConfigured || false;
      nearbyFlightsCache = {
        flights: nextFlights,
        syncConfigured: nextSyncConfigured,
      };
      setFlights(nextFlights);
      setSyncConfigured(nextSyncConfigured);
    };
    const shouldRefreshNow = revision > 0 || nearbyFlightsCache === null;
    if (shouldRefreshNow) {
      void fetch("/api/flights/nearby", { cache: "no-store" })
        .then((response) => response.json())
        .then(apply)
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    const refreshStale = () => {
      void fetch("/api/flights/nearby", { method: "POST", cache: "no-store" })
        .then((response) => response.json())
        .then(apply)
        .catch(() => {});
    };
    if (shouldRefreshNow) refreshStale();
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
  }, [revision]);
  async function syncFlight(flight: NearbyFlight) {
    if (!syncConfigured || syncingId) return;
    setSyncingId(flight.id);
    try {
      const response = await fetch(`/api/trips/${flight.trip_id}/flights/${flight.id}/sync`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "อัปเดตเที่ยวบินไม่สำเร็จ");
      const refreshed = await fetch("/api/flights/nearby", { cache: "no-store" });
      const latest = await refreshed.json();
      if (refreshed.ok && Array.isArray(latest.flights)) {
        cacheNearbyFlights(latest.flights, syncConfigured);
        setFlights(latest.flights);
      }
      notify("อัปเดตข้อมูลเที่ยวบินแล้ว");
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "อัปเดตเที่ยวบินไม่สำเร็จ");
    } finally {
      setSyncingId(null);
    }
  }
  if (!loading && !visibleFlights.length) return null;
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
        ) : visibleFlights.map((flight) => (
          <FlightSnapshotCard
            key={flight.id}
            flight={flight}
            now={now}
            openFlightTrip={openFlightTrip}
            onSync={(item) => void syncFlight(item)}
            syncing={syncingId === flight.id}
            syncDisabled={!syncConfigured || Boolean(syncingId)}
          />
        ))}
      </div>
    </section>
  );
}

function Dashboard({
  trips,
  favoriteAccommodations,
  counts,
  countryHighlights,
  revision,
  selectTrip,
  manageCollaborators,
  openFlightTrip,
  createTrip,
  viewAll,
  viewAnalytics,
  viewBadges,
  viewTripIdeas,
  notify,
}: {
  trips: Trip[];
  favoriteAccommodations: FavoriteAccommodation[];
  counts: DashboardCounts;
  countryHighlights: CountryHighlight[];
  revision: number;
  selectTrip: (t: Trip) => void;
  manageCollaborators: (trip: Trip) => void;
  openFlightTrip: (tripId: string) => void;
  createTrip: () => void;
  viewAll: (status: TripStatus) => void;
  viewAnalytics: () => void;
  viewBadges: () => void;
  viewTripIdeas: () => void;
  notify: (message: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const now = useMinuteClock().getTime();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [activeFlight, setActiveFlight] = useState<NearbyFlight | null>(null);
  const handleActiveFlightChange = useCallback((flight: NearbyFlight | null) => {
    setActiveFlight((current) => current?.id === flight?.id ? current : flight);
  }, []);
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
  }, [revision]);
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
  const cards = (
    items: Trip[],
    isPast = false,
    prioritizeFirst = false,
    variant: "default" | "upcoming" = "default",
  ) => {
    const renderCard = (trip: Trip, index: number) => (
        <TripCard
          key={trip.id}
          trip={trip}
          past={isPast}
          now={now}
          selectTrip={selectTrip}
          manageCollaborators={manageCollaborators}
          priority={prioritizeFirst && index === 0}
        />
    );
    if (variant === "upcoming") {
      return (
        <div className="trip-grid home-upcoming-grid">
          <div className="home-upcoming-column">
            {items.filter((_, index) => index % 2 === 0).map(renderCard)}
          </div>
          <div className="home-upcoming-column">
            {items.filter((_, index) => index % 2 === 1).map(renderCard)}
          </div>
        </div>
      );
    }
    return <div className="trip-grid">{items.map(renderCard)}</div>;
  };
  const featuredTrip = ongoing[0] || upcoming[0] || null;
  const upcomingForGrid = featuredTrip
    ? upcoming.filter((trip) => trip.id !== featuredTrip.id)
    : upcoming;
  const visitedCountries = counts.countries ?? countryHighlights.length;
  const visitedDestinations = counts.destinations ?? 0;
  const unlockedBadges = counts.badges_unlocked ?? 0;
  const totalBadges = counts.badges_total ?? 0;
  const badgeProgress = Math.round(
    (unlockedBadges / Math.max(1, totalBadges)) * 100,
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
          <h2>
            {status === "upcoming" && <CalendarDays size={18} />}
            {status === "past" && <Images size={18} />}
            {t(title)}
          </h2>
          <span className="section-trip-count">{t(`${count} ทริป`)}</span>
        </div>
        {description && <p>{t(description)}</p>}
      </div>
      {count > 0 && status === "past" && (
        <button className="section-view-all" onClick={() => viewAll(status)}>
          {t("ดูทั้งหมด")}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
  return (
    <div className="screen dashboard-home">
      <PageIntro
        title={`${t("สวัสดี")} ${profile?.display_name?.split(/\s+/)[0] || ""}`}
        titleIcon={<span aria-hidden="true">👋</span>}
        subtitle={t("ออกไปเก็บความทรงจำดีๆ ด้วยกันอีกนะ")}
        subtitleIcon={<Heart size={20} fill="currentColor" />}
      />

      {activeFlight ? (
        <section className="dashboard-featured-trip dashboard-featured-flight" aria-label={t("เที่ยวบินที่กำลังเดินทาง")}>
          <FlightSnapshotCard
            flight={activeFlight}
            now={now}
            openFlightTrip={openFlightTrip}
            featured
          />
        </section>
      ) : featuredTrip && (
        <section className="dashboard-featured-trip" aria-label={t("ทริปถัดไปของเรา")}>
          <TripCard
            trip={featuredTrip}
            now={now}
            selectTrip={selectTrip}
            manageCollaborators={manageCollaborators}
            priority
          />
        </section>
      )}

      <section className="dashboard-quick-actions" aria-label={t("ทางลัด")}>
        <button type="button" onClick={createTrip}>
          <Plus size={20} />
          <strong>{t("สร้างทริป")}</strong>
        </button>
        <button type="button" onClick={() => viewAll("all")}>
          <Luggage size={19} />
          <strong>{t("ทริปทั้งหมด")}</strong>
        </button>
        <button type="button" onClick={viewTripIdeas}>
          <Telescope size={19} />
          <strong>{t("ทริปที่เล็งไว้")}</strong>
        </button>
      </section>

      <section className="dashboard-shortcuts" aria-label={t("ทางลัดเพิ่มเติม")}>
        <div className="welcome-shortcuts">
          <button
            type="button"
            className="welcome-insights-btn"
            onClick={viewTripIdeas}
            aria-label={t("ทริปที่เล็งไว้")}
          >
            <Telescope size={15} />
            <span>{t("เล็งไว้")}</span>
          </button>
          <button
            type="button"
            className="welcome-insights-btn"
            onClick={viewBadges}
            aria-label={t("เข็มกลัดท่องเที่ยว")}
          >
            <MapPin size={15} />
            <span>{t("เข็มกลัด")}</span>
          </button>
          <button
            type="button"
            className="welcome-insights-btn"
            onClick={viewAnalytics}
            aria-label={t("สถิติการเดินทาง")}
          >
            <ChartNoAxesColumnIncreasing size={15} />
            <span>{t("สถิติ")}</span>
          </button>
        </div>
      </section>
      <NearbyFlights
        openFlightTrip={openFlightTrip}
        notify={notify}
        revision={revision}
        onActiveFlightChange={handleActiveFlightChange}
      />
      {(upcomingForGrid.length > 0 || !featuredTrip) && (
        <>
          {heading(
            "UPCOMING JOURNEYS",
            "ทริปที่กำลังจะมาถึง",
            upcomingForGrid.length,
            "upcoming",
          )}
          {upcomingForGrid.length ? (
            cards(upcomingForGrid, false, false, "upcoming")
          ) : (
            <EmptyState
              title="หน้ากระดาษนี้ยังว่าง"
              description="สร้างทริปใหม่ แล้วเริ่มเติมสถานที่ที่อยากไปกัน"
              action="สร้างทริปใหม่"
              onClick={createTrip}
            />
          )}
        </>
      )}
      <section className="dashboard-badge-section" aria-label={t("เข็มกลัดท่องเที่ยว")}>
        <button type="button" onClick={viewBadges} aria-label={t("เปิดเข็มกลัดท่องเที่ยว")}>
          <span
            className="dashboard-badge-ring"
            style={{ "--badge-progress": `${badgeProgress * 3.6}deg` } as CSSProperties}
          >
            <b>{badgeProgress}%</b>
          </span>
          <span className="dashboard-badge-copy">
            <small>{t("สะสมแล้ว")}</small>
            <strong>
              <span className="dashboard-badge-count-current">{unlockedBadges} /</span>{" "}
              <span className="dashboard-badge-count-total">{totalBadges}</span>
            </strong>
            <em>{t("ออกเดินทางต่อไป เก็บให้ครบทุกที่เลย!")}</em>
          </span>
          <Image
            src="/badge-progress-mountains-v2.png"
            alt=""
            width={2043}
            height={770}
            className="dashboard-badge-art"
            aria-hidden="true"
          />
        </button>
      </section>
      <section className="dashboard-memory-stats" aria-label={t("ความทรงจำของเรา")}>
        <div>
          <button type="button" onClick={viewAnalytics}>
            <i><Luggage size={18} /></i>
            <span><strong>{counts.total}</strong><small>{t("ทริปทั้งหมด")}</small></span>
          </button>
          <button type="button" onClick={viewAnalytics}>
            <i><Globe2 size={18} /></i>
            <span><strong>{visitedCountries}</strong><small>{t("ประเทศที่เคยไป")}</small></span>
          </button>
          <button type="button" onClick={viewAnalytics}>
            <i><MapPin size={18} /></i>
            <span><strong>{visitedDestinations}</strong><small>{t("จังหวัดที่เคยไป")}</small></span>
          </button>
        </div>
      </section>
      {countryHighlights.length > 0 && (
        <PastCountryHighlights items={countryHighlights} />
      )}
      <div className="past-section">
        {heading(
          "PAST JOURNEYS",
          "ทริปที่ผ่านมาแล้ว",
          counts.past,
          "past",
        )}
        {past.length ? (
          cards(past.slice(0, 8), true, false, "upcoming")
        ) : (
          <article className="card past-empty">
            {t("เมื่อจบทริปแล้ว เราจะเก็บการเดินทางไว้ตรงนี้ให้อัตโนมัติ")}
          </article>
        )}
      </div>
      {favoriteAccommodations.length > 0 && (
        <section
          className="dashboard-favorite-hotels"
          aria-label={t("โรงแรมที่ชื่นชอบ")}
        >
          <div className="dashboard-favorite-hotels-head">
            <span aria-hidden="true"><Heart size={16} fill="currentColor" /></span>
            <h2>{t("โรงแรมที่ชื่นชอบ")}</h2>
          </div>
          <div className="dashboard-favorite-hotels-scroll">
            {favoriteAccommodations.map((hotel, index) => (
              <article
                className="dashboard-favorite-hotel-card"
                key={hotel.id}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/trips/${hotel.trip_id}?view=stays&accommodation=${hotel.id}`,
                    )
                  }
                  aria-label={`${t("เปิดที่พัก")} ${hotel.name}`}
                >
                  <span className="dashboard-favorite-hotel-image">
                    <Image
                      src={hotel.image_url || "/travel-postcard-fallback.jpg"}
                      alt={`รูป ${hotel.name}`}
                      fill
                      sizes="(max-width: 520px) 36vw, 160px"
                      priority={index < 3}
                      unoptimized
                    />
                    <i aria-hidden="true"><Heart size={14} fill="currentColor" /></i>
                  </span>
                  <strong>{hotel.name}</strong>
                  <small>{hotel.location || hotel.destination}</small>
                  <em>{hotel.trip_name}</em>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PastCountryHighlights({ items }: { items: CountryHighlight[] }) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const router = useRouter();
  return (
    <section className="country-highlights" aria-label={t("ประเทศที่เคยไป")}>
      <div className="country-highlights-head">
        <div>
          <span className="section-kicker">TRAVEL MEMORIES</span>
          <h2><MapIcon size={18} />{t("ประเทศที่เคยไป")}</h2>
        </div>
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
                <CountryFlagImage code={country.code} label="" />
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
  const lang = useContext(LanguageContext);
  const [analytics, setAnalytics] = useState(datasets);
  const [scope, setScope] = useState<TravelAnalyticsScope>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const refreshMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = analytics[scope];
  useEffect(
    () => () => {
      if (refreshMessageTimer.current) clearTimeout(refreshMessageTimer.current);
    },
    [],
  );
  const refreshAnalytics = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
      setAnalytics(body as TravelAnalyticsCollection);
      setRefreshMessage("อัปเดตสถิติล่าสุดแล้ว");
    } catch (error) {
      setRefreshMessage(
        error instanceof Error
          ? error.message
          : "รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setRefreshing(false);
      if (refreshMessageTimer.current) clearTimeout(refreshMessageTimer.current);
      refreshMessageTimer.current = setTimeout(
        () => setRefreshMessage(""),
        2400,
      );
    }
  };
  const money = (value: number) => `฿${bahtFormat(value)}`;
  const maxCountryTrips = Math.max(
    1,
    ...data.countries.map((item) => item.trips),
  );
  const maxDestinationTrips = Math.max(
    1,
    ...data.destinations.map((item) => item.trips),
  );
  const flightInsights = data.flights;
  const ranking = scope === "domestic" ? data.destinations : data.countries;
  const topAirline = flightInsights.airlines[0];
  const topPeriod = [...flightInsights.periods].sort((a, b) => b.flights - a.flights)[0];
  const topRoute = flightInsights.routes[0];
  const locationCount = scope === "domestic" ? data.totals.destinations : data.totals.countries;
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
  const refreshButton = (
    <button
      className="analytics-refresh-fab"
      type="button"
      onClick={() => void refreshAnalytics()}
      disabled={refreshing}
      aria-label={t(refreshing ? "กำลังอัปเดต…" : "รีเฟรช")}
      title={t(refreshing ? "กำลังอัปเดต…" : "รีเฟรช")}
    >
      <RefreshCw className={refreshing ? "analytics-refresh-spinning" : ""} size={21} />
    </button>
  );
  const analyticsHero = (
    <header className="analytics-memory-heading">
      <div>
        <h1>{t("ความทรงจำของเรา")} <MapIcon size={24} /></h1>
        <p>{t("เก็บทุกการเดินทาง ให้เป็นเรื่องราวที่สวยงามเสมอ")} <Heart size={15} fill="currentColor" /></p>
      </div>
      <span aria-hidden="true">Collect<br />Trips<br /><b>Not Things ♡</b></span>
      {refreshButton}
    </header>
  );

  if (!data.totals.trips)
    return (
      <div className="screen analytics-screen analytics-redesign">
        {refreshMessage && (
          <div className="toast toast-success" role="status" aria-live="polite">
            <CheckCircle2 size={17} />
            {t(refreshMessage)}
          </div>
        )}
        {analyticsHero}
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
    <div className="screen analytics-screen analytics-redesign">
      {refreshMessage && (
        <div className="toast toast-success" role="status" aria-live="polite">
          <CheckCircle2 size={17} />
          {t(refreshMessage)}
        </div>
      )}
      {analyticsHero}

      {scopeFilter}

      <section className="analytics-memory-kpis" aria-label={t("สถิติการเดินทาง")}>
        <article className="is-orange"><i><Luggage size={24} /></i><div><strong>{data.totals.trips}</strong><b>{t("ทริปทั้งหมด")}</b><small>{t("การเดินทางที่เต็มไปด้วยเรื่องราว")}</small></div></article>
        <article className="is-mint"><i><Globe2 size={24} /></i><div><strong>{locationCount}</strong><b>{t(scope === "domestic" ? "จังหวัดที่เคยไป" : "ประเทศที่เคยไป")}</b><small>{t("โลกกว้างยังมีอีกมากให้ค้นหา")}</small></div></article>
        <article className="is-pink"><i><MapPin size={24} /></i><div><strong>{data.totals.destinations}</strong><b>{t("จุดหมายที่บันทึกไว้")}</b><small>{t("ทุกสถานที่คือความทรงจำ")}</small></div></article>
        <article className="is-blue"><i><WalletCards size={24} /></i><div><strong>{money(data.totals.averageExpense)}</strong><b>{t("ค่าใช้จ่ายเฉลี่ยต่อทริป")}</b><small>{t("จากค่าใช้จ่ายที่บันทึกไว้")}</small></div></article>
      </section>

      <section className="analytics-journey-map">
        <div className="analytics-memory-section-head"><h2><MapPin size={18} />{t("แผนที่การเดินทางของเรา")}</h2><small>{data.totals.countries} {t("ประเทศ")} · {data.totals.destinations} {t("เมือง")}</small></div>
        <div className="analytics-map-canvas" role="img" aria-label={t("แผนที่จุดหมายที่เคยเดินทาง")}>
          <span className="analytics-map-land is-one" /><span className="analytics-map-land is-two" /><span className="analytics-map-land is-three" />
          <span className="analytics-map-path is-one" /><span className="analytics-map-path is-two" />
          <Plane className="analytics-map-plane" size={23} />
          {(scope === "domestic" ? data.destinations : data.countries).slice(0, 5).map((item, index) => {
            const label = "country" in item ? item.country : (lang === "EN" ? item.nameEn : item.nameTh);
            const positions = [[18, 42], [55, 69], [76, 30], [43, 29], [82, 66]];
            return <span className="analytics-map-pin" key={"country" in item ? item.country : item.id} style={{ "--map-x": `${positions[index][0]}%`, "--map-y": `${positions[index][1]}%` } as CSSProperties}><i />{label}</span>;
          })}
          <em>Good Trips<br />Happier Us ♡</em>
        </div>
      </section>

      <div className="analytics-memory-grid">
        <section className="analytics-ranking-card">
          <div className="analytics-memory-section-head"><h2><ChartNoAxesColumnIncreasing size={18} />{t(scope === "domestic" ? "จังหวัดที่ไปบ่อยที่สุด" : "ประเทศที่เราไปบ่อยที่สุด")}</h2></div>
          <div className="analytics-ranking-list">
            {ranking.slice(0, 5).map((item, index) => {
              const domestic = "nameTh" in item;
              const label = domestic ? (lang === "EN" ? item.nameEn : item.nameTh) : item.country;
              const count = item.trips;
              const maximum = domestic ? maxDestinationTrips : maxCountryTrips;
              return <div key={domestic ? item.id : item.country}><b>{index + 1}</b><i>{domestic ? <MapPin size={15} /> : countryByCode(item.countryCode) ? <CountryFlagImage code={item.countryCode} label={label} /> : "🌍"}</i><span><strong>{label}</strong><em><u style={{ width: `${count / maximum * 100}%` }} /></em></span><small>{count} {t("ทริป")}</small></div>;
            })}
          </div>
        </section>

        <section className="analytics-year-card">
          <div className="analytics-memory-section-head"><h2><ArrowUp size={18} />{t("การเดินทางในแต่ละปี")}</h2></div>
          <AnalyticsYearTrend years={data.years} money={money} tripLabel={t("ทริป")} />
          <div className="analytics-year-summary"><span><Plane size={17} /><b>{flightInsights.totals.segments}</b><small>{t("ช่วงบินทั้งหมด")}</small></span><span><CalendarDays size={17} /><b>{data.years.length}</b><small>{t("ปีที่มีทริป")}</small></span></div>
        </section>
      </div>

      <section className="analytics-insights">
        <div className="analytics-memory-section-head"><h2><Sun size={18} />{t("อินไซต์การเดินทางของเรา")}</h2></div>
        <div>
          <article className="is-orange"><i><Plane size={20} /></i><span><small>{t("สายการบินที่ใช้บ่อย")}</small><strong>{topAirline?.name || t("ยังไม่มีข้อมูล")}</strong><em>{topAirline ? `${topAirline.flights} ${t("เที่ยว")}` : "—"}</em></span></article>
          <article className="is-blue"><i><Moon size={20} /></i><span><small>{t("ช่วงเวลาที่บินบ่อย")}</small><strong>{topPeriod ? t(topPeriod.label) : t("ยังไม่มีข้อมูล")}</strong><em>{topPeriod ? `${topPeriod.flights} ${t("เที่ยว")}` : "—"}</em></span></article>
          <article className="is-mint"><i><Navigation size={20} /></i><span><small>{t("เส้นทางที่บินบ่อย")}</small><strong>{topRoute?.route || t("ยังไม่มีข้อมูล")}</strong><em>{topRoute ? `${topRoute.flights} ${t("เที่ยว")}` : "—"}</em></span></article>
        </div>
      </section>
    </div>
  );
}

function CompactTripCard({
  trip,
  now,
  selectTrip,
  manageCollaborators,
  priority = false,
}: {
  trip: Trip;
  now: number;
  selectTrip: (trip: Trip) => void;
  manageCollaborators: (trip: Trip) => void;
  priority?: boolean;
}) {
  const t = useT();
  const temporal = tripTemporalStatus(trip, now);
  const budget = Number(trip.budget_thb || 0);
  const actualSpent = Number(trip.actual_spent_thb || 0);
  const hasActualSpent = actualSpent > 0;
  const displayedAmount = hasActualSpent ? actualSpent : budget;
  const amountState = !hasActualSpent
    ? "is-budget-placeholder"
    : actualSpent > budget
      ? "is-over-budget"
      : "is-actual-spent";
  const ongoing = temporal.ongoing;
  const past = temporal.past;
  const StatusIcon = past ? CheckCircle2 : ongoing ? Navigation : CalendarDays;
  const status = past
    ? t("ที่ผ่านมาแล้ว")
    : ongoing
      ? t("กำลังเดินทาง")
      : t(`อีก ${temporal.daysUntil} วัน`);
  return (
    <article
      id={`trip-card-${trip.id}`}
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
        <span className="compact-trip-status">
          <StatusIcon size={12} />
          <span>{status}</span>
        </span>
        {past && <TripRatingBadge trip={trip} variant="compact" />}
      </div>
      <div className="compact-trip-body">
        <h3>{trip.name}</h3>
        <p>
          <TripCountryFlag trip={trip} />
          <span>
            {formatTripDestination(
              trip.destination,
              trip.country_code,
              trip.country_name,
              trip.trip_destinations,
            )}
          </span>
        </p>
        <small>
          {tripRangeLabel(trip)} · ({t(`${trip.total_days} วัน`)})
        </small>
        <div className="compact-trip-meta">
          <span className={amountState}>
            <WalletCards size={12} />
            ฿{displayedAmount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
      <SharedTripAvatars
        members={trip.members}
        variant="compact"
        limit={3}
        onClick={() => manageCollaborators(trip)}
        actionLabel={t("ผู้ร่วมทริป")}
      />
    </article>
  );
}

function TripsDirectory({
  initialFilters,
  initialData,
  revision,
  selectTrip,
  manageCollaborators,
  createTrip,
  onRefreshComplete,
}: {
  initialFilters: TripFilters;
  initialData?: { items: Trip[]; total: number; years: number[]; hasMore: boolean; statusCounts?: Record<TripStatus,number> };
  revision: number;
  selectTrip: (trip: Trip, origin: string) => void;
  manageCollaborators: (trip: Trip) => void;
  createTrip: () => void;
  onRefreshComplete?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const validStatus = (value: string): TripStatus =>
    ["upcoming", "past"].includes(value)
      ? (value as TripStatus)
      : "all";
  const validType = (value: string): TripType =>
    ["domestic", "international"].includes(value)
      ? (value as TripType)
      : "all";
  const parseYears = (value:string) => [...new Set(value.split(",").map(item=>item.trim()).filter(item=>/^\d{4}$/.test(item)))];
  const [status, setStatus] = useState<TripStatus>(() =>
    validStatus(initialFilters.status),
  );
  const [tripType, setTripType] = useState<TripType>(() =>
    validType(initialFilters.type),
  );
  const [selectedYears, setSelectedYears] = useState<string[]>(()=>parseYears(initialFilters.year));
  const [queryText, setQueryText] = useState(initialFilters.q || "");
  const sort = "latest";
  const [items, setItems] = useState<Trip[]>(() =>
    applyCachedTripReviewSummaries(initialData?.items || []),
  );
  const [years, setYears] = useState<number[]>(initialData?.years || []);
  const [statusCounts,setStatusCounts]=useState<Record<TripStatus,number>>(()=>initialData?.statusCounts||{all:initialData?.total||0,ongoing:0,upcoming:0,past:0});
  const [hasMore, setHasMore] = useState(Boolean(initialData?.hasMore));
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [draftTripType,setDraftTripType]=useState<TripType>(()=>validType(initialFilters.type));
  const [draftYears,setDraftYears]=useState<string[]>(()=>parseYears(initialFilters.year));
  const [loading, setLoading] = useState(!initialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [now] = useState(() => Date.now());
  const skipInitialFetch = useRef(Boolean(initialData));
  const hasContentRef = useRef(Boolean(initialData));
  const lastRestoreRefreshRef = useRef(0);
  const restoredFocusRef = useRef(false);
  useEffect(()=>{if(!filtersOpen)return;const root=document.documentElement;root.classList.add("confirm-open");return()=>root.classList.remove("confirm-open")},[filtersOpen]);
  const focusTripId = /^[0-9a-f-]{36}$/i.test(initialFilters.focus)
    ? initialFilters.focus
    : "";
  const openTrip = (trip: Trip) => {
    const params = new URLSearchParams(window.location.search);
    params.set("focus", trip.id);
    params.set("loaded", String(Math.max(20, items.length)));
    const origin = `/trips?${params.toString()}`;
    window.history.replaceState(window.history.state, "", origin);
    selectTrip(trip, origin);
  };
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
    if (loading || restoredFocusRef.current || !focusTripId) return;
    const target = document.getElementById(`trip-card-${focusTripId}`);
    if (!target) return;
    restoredFocusRef.current = true;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "auto" });
      target
        .querySelector<HTMLElement>(".compact-trip-link")
        ?.focus({ preventScroll: true });
      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      url.searchParams.delete("loaded");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}`,
      );
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusTripId, items, loading]);
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
        if (selectedYears.length) params.set("year", selectedYears.join(","));
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
          if(data.statusCounts)setStatusCounts({all:Number(data.statusCounts.all||0),ongoing:Number(data.statusCounts.ongoing||0),upcoming:Number(data.statusCounts.upcoming||0),past:Number(data.statusCounts.past||0)});
          setHasMore(Boolean(data.hasMore));
          hasContentRef.current = true;
        } catch (error) {
          if (
            (error as Error).name !== "AbortError" &&
            !hasContentRef.current
          ) {
            setItems([]);
            setHasMore(false);
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            onRefreshComplete?.();
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
    selectedYears,
    queryText,
    sort,
    revision,
    refreshToken,
    router,
    initialFilters.q,
    onRefreshComplete,
  ]);
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
    if (selectedYears.length) params.set("year", selectedYears.join(","));
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
  const statuses: Array<{value:TripStatus;label:string;Icon:typeof Luggage}> = [
    {value:"all",label:"ทั้งหมด",Icon:Luggage},
    {value:"upcoming",label:"กำลังจะไป",Icon:Plane},
    {value:"past",label:"ที่ผ่านมา",Icon:CheckCircle2},
  ];
  const tripTypes:Array<{value:TripType;label:string;Icon:typeof Luggage}>=[
    {value:"all",label:"ทั้งหมด",Icon:Luggage},
    {value:"domestic",label:"ในประเทศ",Icon:MapPin},
    {value:"international",label:"ต่างประเทศ",Icon:Globe2},
  ];
  const hasActiveTripFilters=tripType!=="all"||selectedYears.length>0;
  const firstPastTripIndex = status === "all"
    ? items.findIndex((trip) => tripTemporalStatus(trip, now).past)
    : -1;
  return (
    <>
      <div className="screen trips-directory">
      <PageIntro title={t("ทริป")} titleIcon={<Heart size={22} fill="currentColor"/>} subtitle={t("เก็บทุกการเดินทาง ไว้ในที่เดียว")}/>
      <div className="trip-directory-search-row">
          <label className="trip-search trip-ideas-search trip-directory-search">
            <Search size={20} />
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
          <button className={`trip-directory-filter-toggle ${filtersOpen||hasActiveTripFilters?"active":""}`} type="button" onClick={()=>{setDraftTripType(tripType);setDraftYears([...selectedYears]);setFiltersOpen(true)}} aria-expanded={filtersOpen} aria-label={t("ตั้งค่าตัวกรอง")}><Settings2 size={21}/>{hasActiveTripFilters?<i className="notification-dot trip-directory-filter-dot" aria-label={t("กำลังใช้ตัวกรอง")}/>:null}</button>
          <button className="trip-directory-add-button" type="button" onClick={createTrip} aria-label={t("สร้างทริปใหม่")} title={t("สร้างทริปใหม่")}><Plus size={21}/></button>
      </div>
      {filtersOpen&&(
        <BottomSheet
          title={t("เลือกตัวกรองทริป")}
          subtitle={t("เลือกประเภทและปีที่ต้องการได้มากกว่า 1 ปี แล้วกดยืนยันเพื่อแสดงผล")}
          closeLabel={t("ยกเลิก")}
          onClose={()=>setFiltersOpen(false)}
          onSubmit={(event)=>{event.preventDefault();setTripType(draftTripType);setSelectedYears([...draftYears].sort((a,b)=>Number(b)-Number(a)));setFiltersOpen(false)}}
          className="trip-directory-filter-sheet"
          bodyClassName="bottom-sheet-body trip-directory-filter-body"
          submitLabel={t("แสดงผล")}
          deleteLabel={t("รีเซ็ตตัวกรอง")}
          deleteIcon={<RotateCcw size={18}/>}
          onDelete={()=>{setDraftTripType("all");setDraftYears([]);setTripType("all");setSelectedYears([]);setFiltersOpen(false)}}
        >
          <section className="trip-directory-filter-section">
            <h3>{t("ประเภททริป")}</h3>
            <div className="trip-type-options status-filter trip-directory-type-options" role="group" aria-label={t("ประเภททริป")}>
              {tripTypes.map(({value,label,Icon})=><button type="button" key={value} className={`${draftTripType===value?"active":""} status-${value}`} onClick={()=>setDraftTripType(value)} aria-pressed={draftTripType===value}><Icon size={24}/><span><strong>{t(label)}</strong></span></button>)}
            </div>
          </section>
          <section className="trip-directory-filter-section">
            <h3>{t("ปีที่เดินทาง")}</h3>
            <div className="year-filter" role="group" aria-label={t("ปีที่เดินทาง")}>
              <button type="button" className={!draftYears.length?"active":""} onClick={()=>setDraftYears([])} aria-pressed={!draftYears.length}>{t("ทุกปี")}</button>
              {years.map(value=>{const stringValue=String(value);const active=draftYears.includes(stringValue);return <button type="button" key={value} className={active?"active":""} onClick={()=>setDraftYears(current=>active?current.filter(item=>item!==stringValue):[...current,stringValue])} aria-pressed={active}>{value}</button>})}
            </div>
          </section>
        </BottomSheet>
      )}
      <div className="status-filter">
        {statuses.map(({value,label,Icon}) => (
          <button
            key={value}
            className={`${status === value ? "active" : ""} status-${value}`}
            onClick={() => setStatus(value)}
          >
            <Icon size={24}/><span><strong>{t(label)}</strong><small>{statusCounts[value]} {t("ทริป")}</small></span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="compact-trip-grid compact-trip-list-skeleton" role="status" aria-label={t("กำลังโหลดทริป…")}>
          {Array.from({length:4},(_,index)=><span className="compact-trip-skeleton-card" key={index}><i/><b><em/><em/><em/></b></span>)}
        </div>
      ) : items.length ? (
        <>
          <div className="compact-trip-grid">
            {items.map((trip, index) => (
              <Fragment key={trip.id}>
                {firstPastTripIndex > 0 && index === firstPastTripIndex ? (
                  <div className="trip-ideas-divider trip-directory-divider" role="separator" aria-label={t("ทริปที่ผ่านมาแล้ว")}>
                    <span />
                    <h2>{t("ทริปที่ผ่านมาแล้ว")}</h2>
                    <span />
                  </div>
                ) : null}
                <CompactTripCard trip={trip} now={now} priority={index<3} selectTrip={openTrip} manageCollaborators={manageCollaborators}/>
              </Fragment>
            ))}
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
  openReviews,
  manageMembers,
  goBack,
  editTrip,
}: {
  trip: Trip;
  openReviews?: () => void;
  manageMembers?: () => void;
  goBack?: () => void;
  editTrip?: () => void;
}) {
  const t = useT();
  const now = useMinuteClock();
  const coverUrl = trip.cover_image_url || DEFAULT_TRIP_COVER;
  const ended = tripHasEnded(trip, now);
  const temporal = tripTemporalStatus(trip, now);
  const countdownLabel = !trip.outbound_departure_at
    ? t("ยังไม่กำหนดวัน")
    : temporal.ongoing
      ? t("กำลังเดินทาง")
      : t(`อีก ${temporal.daysUntil} วัน`);
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
      {goBack && (
        <button className="trip-cover-back" type="button" onClick={goBack} aria-label={t("ย้อนกลับ")}>
          <ChevronLeft size={21} />
        </button>
      )}
      {editTrip && (
        <div className="trip-cover-actions">
          <button type="button" onClick={editTrip} aria-label={t("แก้ไข")} title={t("แก้ไข")}>
            <Pencil size={20} />
          </button>
        </div>
      )}
      <div
        className={`trip-cover-copy ${trip.members?.length ? "has-collaborators" : ""}`}
      >
        {!ended && (
          <span className={`trip-header-countdown ${temporal.ongoing ? "is-ongoing" : ""}`}>
            <CalendarDays size={12} />
            {countdownLabel}
          </span>
        )}
        <h1 className="page-title">{trip.name}</h1>
        <span className="eyebrow">
          <TripCountryFlag trip={trip} />
          {formatTripDestination(
            trip.destination,
            trip.country_code,
            trip.country_name,
            trip.trip_destinations,
          )}
        </span>
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

type TripSectionView = "plan" | "expenses" | "flights" | "insurance" | "stays" | "workspace";
type TripCompletionStatus = {
  flightIncomplete: boolean;
  accommodationIncomplete: boolean;
  insuranceIncomplete: boolean;
  checklistIncomplete: boolean;
};
function useTripCompletionStatus(
  tripId: string,
  hasFlights: boolean,
  hasAccommodations: boolean,
  totalDays: number,
  countryCode?: string | null,
) {
  const [completion, setCompletion] = useState<TripCompletionStatus>({
    flightIncomplete: false,
    accommodationIncomplete: false,
    insuranceIncomplete: false,
    checklistIncomplete: false,
  });
  useEffect(() => {
    let active = true;
    async function loadCompletion() {
      try {
        const response = await fetch(`/api/trips/${tripId}/completion`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!active || !response.ok) return;
        setCompletion({
          flightIncomplete: Boolean(body.flightIncomplete),
          accommodationIncomplete: Boolean(body.accommodationIncomplete),
          insuranceIncomplete: Boolean(body.insuranceIncomplete),
          checklistIncomplete: Boolean(body.checklistIncomplete),
        });
      } catch {
        // Status dots are supplemental; navigation remains available offline.
      }
    }
    const handleChanged = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail?.tripId;
      if (!changedTripId || changedTripId === tripId) void loadCompletion();
    };
    void loadCompletion();
    window.addEventListener("trip-completion-changed", handleChanged);
    return () => {
      active = false;
      window.removeEventListener("trip-completion-changed", handleChanged);
    };
  }, [tripId, hasFlights, hasAccommodations, totalDays, countryCode]);
  return completion;
}

function TripSectionNav({
  trip,
  completion,
  active,
  select,
  workspaceTab,
}: {
  trip: Trip;
  completion: TripCompletionStatus;
  active: TripSectionView;
  select: (view: TripSectionView, workspaceTab?: WorkspaceTab) => void;
  workspaceTab?: WorkspaceTab;
}) {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (!moreOpen) return;
    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const alreadyLocked = root.classList.contains("sheet-open");
    root.classList.add("sheet-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      if (!alreadyLocked) root.classList.remove("sheet-open");
      window.scrollTo(0, scrollY);
    };
  }, [moreOpen]);
  type TripMenuItem = {
    id: string;
    label: string;
    Icon: typeof MapIcon;
    disabled?: boolean;
    action: () => void;
    active?: boolean;
    availableInTrip?: boolean;
    hasNotification?: boolean;
  };
  const closeAndRun = (action: () => void) => {
    setMoreOpen(false);
    action();
  };
  const sections: TripMenuItem[] = [
    { id: "plan", label: "แผน", Icon: MapIcon, active: active === "plan", action: () => select("plan") },
    { id: "expenses", label: "ค่าใช้จ่าย", Icon: WalletCards, active: active === "expenses", action: () => select("expenses") },
    { id: "flights", label: "เที่ยวบิน", Icon: Plane, disabled: !trip.has_flights, availableInTrip: Boolean(trip.has_flights), hasNotification: completion.flightIncomplete, active: active === "flights", action: () => select("flights") },
    { id: "stays", label: "ที่พัก", Icon: BedDouble, disabled: trip.total_days <= 1, availableInTrip: trip.total_days > 1, hasNotification: completion.accommodationIncomplete, active: active === "stays", action: () => select("stays") },
    { id: "checklist", label: "Checklist", Icon: ClipboardList, hasNotification: completion.checklistIncomplete, active: active === "workspace" && workspaceTab === "checklist", action: () => select("workspace", "checklist") },
    { id: "photos", label: "รูปภาพ / Link", Icon: Images, disabled: !trip.google_photos_url, availableInTrip: Boolean(trip.google_photos_url), action: () => trip.google_photos_url && window.open(trip.google_photos_url, "_blank", "noopener,noreferrer") },
    { id: "insurance", label: "ประกัน", Icon: ShieldCheck, disabled: trip.country_code === "TH", availableInTrip: trip.country_code !== "TH", hasNotification: completion.insuranceIncomplete, active: active === "insurance", action: () => select("insurance") },
    { id: "documents", label: "เอกสาร", Icon: FileText, active: active === "workspace" && workspaceTab === "documents", action: () => select("workspace", "documents") },
    { id: "export", label: "Download", Icon: Download, action: () => { window.open(`/api/trips/${trip.id}/export-plan`, "_self"); } },
  ];
  const primary = sections
    .filter(({ availableInTrip }) => availableInTrip !== false)
    .slice(0, 4);
  const primaryIds = new Set(primary.map(({ id }) => id));
  const overflowIsActive = sections.some(
    ({ id, active: isActive }) => isActive && !primaryIds.has(id),
  );
  const overflowHasNotification = sections.some(
    ({ id, hasNotification }) => hasNotification && !primaryIds.has(id),
  );
  return (
    <>
      <nav className="trip-section-nav has-5-items" aria-label={t("เลือกข้อมูลทริป")}>
        {primary.map(({ id, label, Icon, action, active: isActive, disabled, hasNotification }) => (
          <button type="button" className={`trip-menu-${id}${isActive ? " active" : ""}`} key={id} onClick={action} disabled={disabled} aria-current={isActive ? "page" : undefined}>
            <i className="trip-section-icon"><Icon className="trip-menu-fill-icon" size={26} aria-hidden="true" />{hasNotification ? <b className="notification-dot" aria-label={t("ข้อมูลยังไม่ครบ")} /> : null}</i>
            <span>{t(label)}</span>
          </button>
        ))}
        <button type="button" className={`trip-menu-more${overflowIsActive ? " active" : ""}`} onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          <i className="trip-section-icon"><Menu className="trip-menu-fill-icon" size={26} aria-hidden="true" />{overflowHasNotification ? <b className="notification-dot" aria-label={t("มีข้อมูลที่ต้องกรอกเพิ่มเติม")} /> : null}</i>
          <span>{t("อื่นๆ")}</span>
        </button>
      </nav>
      {moreOpen && typeof document !== "undefined" && createPortal(
        <div className="trip-menu-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMoreOpen(false)}>
          <section className="trip-menu-sheet" role="dialog" aria-modal="true" aria-label={t("เมนูทั้งหมด")}>
            <span className="sheet-grabber" />
            <header><div><strong>{t("เมนูทั้งหมด")}</strong><small>{t("เลือกข้อมูลหรือเครื่องมือของทริป")}</small></div><button type="button" onClick={() => setMoreOpen(false)} aria-label={t("ปิด")}><X size={19} /></button></header>
            <div className="trip-menu-sheet-grid">
              {sections.map(({ id, label, Icon, action, active: isActive, disabled, hasNotification }) => (
                <button type="button" key={id} className={`trip-menu-${id}${isActive ? " active" : ""}`} disabled={disabled} onClick={() => closeAndRun(action)}>
                  <i><Icon className="trip-menu-fill-icon" size={26} aria-hidden="true" />{hasNotification ? <b className="notification-dot" aria-label={t("ข้อมูลยังไม่ครบ")} /> : null}</i><span>{t(label)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>, document.body)}
    </>
  );
}

function TimelineExpenseMenu({
  item,
  openCost,
  open,
  onOpen,
  onClose,
}: {
  item: Itinerary;
  openCost: (
    item: Itinerary,
    index?: number,
    defaultDay?: number,
    returnToExpenseList?: () => void,
  ) => void;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const costs = item.cost_items || [];
  return (
    <div className="timeline-expense-menu">
      <button
        type="button"
        className="timeline-expense-trigger"
        onClick={() => {
          onClose();
          openCost(item);
        }}
        aria-label={t("เพิ่มค่าใช้จ่าย")}
        title={t("เพิ่มค่าใช้จ่าย")}
      >
        <WalletCards size={17} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <BottomSheet
          title={t("รายการค่าใช้จ่าย")}
          subtitle={item.place_name}
          closeLabel={t("ปิด")}
          onClose={onClose}
          className="timeline-expense-sheet"
          bodyClassName="bottom-sheet-body timeline-expense-sheet-body"
        >
          <div className="timeline-expense-list">
            {costs.length ? costs.map((cost, index) => (
              <button
                type="button"
                key={cost.id || `${cost.key}-${index}`}
                onClick={() => {
                  onClose();
                  openCost(item, index, undefined, onOpen);
                }}
              >
                <ExpenseCategoryIcon category={cost.category} />
                <span><b>{cost.key}</b><small>{costSourceLabel(cost)}</small></span>
                <em>฿{bahtFormat(cost.value)}</em>
              </button>
            )) : <div className="timeline-expense-empty"><WalletCards size={24} /><strong>{t("ยังไม่มีค่าใช้จ่าย")}</strong><small>{t("เพิ่มค่าใช้จ่ายของสถานที่นี้ได้เลย")}</small></div>}
          </div>
          <button
            type="button"
            className="timeline-expense-add"
            onClick={() => {
              onClose();
              openCost(item, undefined, undefined, onOpen);
            }}
          >
            <Plus size={17} />
            {t("เพิ่มค่าใช้จ่าย")}
          </button>
        </BottomSheet>,
        document.body,
      )}
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

function AccommodationBookingText({ platform }: { platform?: string | null }) {
  const bookingPlatform = bookingPlatformByValue(platform);
  if (!bookingPlatform) return null;
  return (
    <span className="accommodation-booking-text">
      จองผ่าน {bookingPlatform.label}
    </span>
  );
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

function SwipeableTimelineDay({
  day,
  totalDays,
  setDay,
  children,
}: {
  day: number;
  totalDays: number;
  setDay: (day: number) => void;
  children: (day: number) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{
    id: number;
    x: number;
    y: number;
    startedAt: number;
    axis: "horizontal" | "vertical" | null;
    deltaX: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const targetDay = useRef<number | null>(null);
  const settling = useRef(false);
  if (totalDays <= 1) return <>{children(day)}</>;
  const centerTrack = () => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = "none";
    track.style.transform = "translate3d(-33.333333%, 0, 0)";
  };
  const settleTrack = (transform: string, nextDay: number | null) => {
    const track = trackRef.current;
    if (!track) return;
    settling.current = true;
    targetDay.current = nextDay;
    track.style.transition =
      "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
    track.style.transform = transform;
  };
  const finishSwipe = (clientX: number, clientY: number) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    if (
      start.axis !== "horizontal" ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      centerTrack();
      return;
    }
    const width = containerRef.current?.clientWidth || 320;
    const fastSwipe =
      performance.now() - start.startedAt < 240 && Math.abs(deltaX) >= 30;
    const horizontalSwipe = Math.abs(deltaX) >= Math.max(56, width * 0.18) || fastSwipe;
    if (!horizontalSwipe) {
      settleTrack("translate3d(-33.333333%, 0, 0)", null);
      return;
    }
    const nextDay = deltaX < 0 ? Math.min(totalDays, day + 1) : Math.max(1, day - 1);
    if (nextDay === day) {
      settleTrack("translate3d(-33.333333%, 0, 0)", null);
      return;
    }
    suppressClick.current = true;
    settleTrack(
      deltaX < 0
        ? "translate3d(-66.666667%, 0, 0)"
        : "translate3d(0, 0, 0)",
      nextDay,
    );
  };
  const panels = [day - 1, day, day + 1];
  return (
    <div
      ref={containerRef}
      className="timeline-day-swipe"
      onPointerDown={(event) => {
        if (!event.isPrimary || settling.current) return;
        pointerStart.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startedAt: performance.now(),
          axis: null,
          deltaX: 0,
        };
        centerTrack();
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start || start.id !== event.pointerId) return;
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (!start.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 7) {
          start.axis =
            Math.abs(deltaX) > Math.abs(deltaY) * 1.15
              ? "horizontal"
              : "vertical";
          if (start.axis === "horizontal") {
            event.currentTarget.setPointerCapture(event.pointerId);
            suppressClick.current = true;
          }
        }
        if (start.axis !== "horizontal") return;
        event.preventDefault();
        const atBoundary =
          (day === 1 && deltaX > 0) ||
          (day === totalDays && deltaX < 0);
        start.deltaX = atBoundary ? deltaX * 0.2 : deltaX;
        const track = trackRef.current;
        if (track)
          track.style.transform = `translate3d(calc(-33.333333% + ${start.deltaX}px), 0, 0)`;
      }}
      onPointerUp={(event) => finishSwipe(event.clientX, event.clientY)}
      onPointerCancel={() => {
        pointerStart.current = null;
        targetDay.current = null;
        settling.current = false;
        suppressClick.current = false;
        // Native vertical scrolling cancels the active pointer. Reset
        // immediately because a centered track has no transition to finish;
        // waiting for transitionend here would leave swiping locked forever.
        centerTrack();
      }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        ref={trackRef}
        className="timeline-day-swipe-track"
        onTransitionEnd={(event) => {
          if (event.currentTarget !== event.target || event.propertyName !== "transform") return;
          const nextDay = targetDay.current;
          targetDay.current = null;
          // Commit the newly visible day before recentering the three-panel
          // track. Keeping both DOM updates in this transition-end frame
          // prevents the previous day from flashing at the center for a frame.
          if (nextDay !== null) flushSync(() => setDay(nextDay));
          centerTrack();
          settling.current = false;
          window.setTimeout(() => {
            suppressClick.current = false;
          }, 80);
        }}
      >
        {panels.map((panelDay, index) => (
          <div
            key={`${day}:${index}`}
            className={`timeline-day-swipe-panel${index === 1 ? " is-current" : ""}`}
            aria-hidden={index !== 1}
          >
            {panelDay >= 1 && panelDay <= totalDays
              ? children(panelDay)
              : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineDayPicker({
  trip,
  day,
  setDay,
  dateLabel,
  itemCount,
  dayCounts,
  swapDay,
  addPlace,
}: {
  trip: Trip;
  day: number;
  setDay: (day: number) => void;
  dateLabel: string;
  itemCount: number;
  dayCounts?: Map<number, number>;
  swapDay?: (targetDay: number) => Promise<void>;
  addPlace: () => void;
}) {
  const t = useT();
  const [pickerMode, setPickerMode] = useState<"select" | "swap" | null>(null);
  const [busyDay, setBusyDay] = useState<number | null>(null);
  const [pendingSwapDay, setPendingSwapDay] = useState<number | null>(null);
  const [pickerError, setPickerError] = useState("");
  const days = Array.from({ length: trip.total_days }, (_, index) => index + 1);
  const chooseDay = (number: number) => {
    if (pickerMode === "swap") {
      if (number !== day) setPendingSwapDay(number);
      return;
    }
    startTransition(() => setDay(number));
    setPickerMode(null);
  };
  const confirmSwap = async () => {
    if (!swapDay || pendingSwapDay === null) return;
    setBusyDay(pendingSwapDay);
    setPickerError("");
    try {
      await swapDay(pendingSwapDay);
      setPickerMode(null);
      setPendingSwapDay(null);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : t("สลับวันไม่สำเร็จ"));
    } finally {
      setBusyDay(null);
    }
  };
  const dayPickerContent = (
    <>
      {pickerError && <p className="day-picker-dialog-error" role="alert">{t(pickerError)}</p>}
      <div className="day-picker-dialog-grid">
        {days.map((number) => {
          const sourceDay = number === day;
          const selected = pickerMode === "swap" ? number === pendingSwapDay : sourceDay;
          return <button type="button" key={number} className={`${selected ? "active" : ""} ${pickerMode === "swap" && sourceDay ? "source" : ""}`} disabled={(pickerMode === "swap" && sourceDay) || busyDay !== null} onClick={() => void chooseDay(number)}><small>DAY</small><strong>{displayTripDay(trip, number)}</strong><span>{dayCounts?.get(number) || 0} {t("สถานที่")}</span></button>;
        })}
      </div>
    </>
  );
  return (
    <div className="timeline-day-picker">
      <TripSectionHeading
        className="timeline-day-heading"
        title={trip.total_days > 1 ? (
          <button type="button" className="timeline-day-picker-trigger" onClick={() => { setPickerError(""); setPickerMode("select"); }} aria-haspopup="dialog">
            <strong>{t(`แผนวันที่ ${displayTripDay(trip, day)}`)}</strong><ChevronDown size={20} aria-hidden="true" />
          </button>
        ) : (
          <span className="timeline-day-picker-static"><strong>{t(`แผนวันที่ ${displayTripDay(trip, day)}`)}</strong></span>
        )}
        subtitle={`${dateLabel} · ${t(`${itemCount} สถานที่`)}`}
        actions={<>
          <button type="button" className="timeline-add-place trip-section-add" onClick={addPlace} aria-label={t(`เพิ่มรายการวันที่ ${displayTripDay(trip, day)}`)} title={t("เพิ่มสถานที่")}><Plus size={21} /><span>{t("เพิ่มสถานที่")}</span></button>
          {swapDay && trip.total_days > 1 ? <button type="button" className="timeline-swap-days" onClick={() => { setPendingSwapDay(null); setPickerError(""); setPickerMode("swap"); }} aria-label={t("สลับวัน")} title={t("สลับวัน")}><ArrowUpDown size={17} /><span>{t("สลับวัน")}</span></button> : null}
        </>}
      />
      {trip.total_days > 1 && pickerMode && typeof document !== "undefined" && createPortal(
        pickerMode === "swap" ? (
          <BottomSheet
            title={t("สลับแผนการเดินทาง")}
            subtitle={t(`แผนและค่าใช้จ่ายของวันที่ ${displayTripDay(trip, day)} จะสลับกับวันที่เลือก`)}
            closeLabel={t("ยกเลิก")}
            onClose={() => setPickerMode(null)}
            onSubmit={(event) => { event.preventDefault(); void confirmSwap(); }}
            busy={busyDay !== null}
            className="timeline-day-sheet"
            bodyClassName="bottom-sheet-body timeline-day-sheet-body"
            submitLabel={t(busyDay !== null ? "กำลังสลับ…" : "ยืนยันสลับวัน")}
            submitDisabled={pendingSwapDay === null || busyDay !== null}
          >
            {dayPickerContent}
          </BottomSheet>
        ) : (
          <BottomSheet
            title={t("เปลี่ยนแผนการเดินทาง")}
            subtitle={t("เลือกวันที่ต้องการดูแผนการเดินทาง")}
            closeLabel={t("ยกเลิก")}
            onClose={() => setPickerMode(null)}
            className="timeline-day-sheet"
            bodyClassName="bottom-sheet-body timeline-day-sheet-body"
          >
            {dayPickerContent}
          </BottomSheet>
        ), document.body)}
    </div>
  );
}

function TimelineInsertPlaceButton({
  previous,
  next,
  onClick,
}: {
  previous: Itinerary;
  next?: Itinerary;
  onClick: (defaultTime: string) => void;
}) {
  const t = useT();
  const defaultTime = insertionPlanTime(previous, next);
  const label = t(next ? "เพิ่มสถานที่ระหว่างจุด" : "เพิ่มสถานที่ถัดไป");
  const positionClass = !next
    ? "is-terminal"
    : next.transport_mode?.trim()
      ? "has-transport"
      : "is-between-cards";
  return (
    <button
      type="button"
      className={`timeline-insert-place ${positionClass}`}
      onClick={() => onClick(defaultTime)}
      aria-label={`${label} · ${defaultTime}`}
      title={`${label} · ${defaultTime}`}
    >
      <Plus size={14} />
    </button>
  );
}

function TripHub({
  trip,
  items,
  cards,
  day,
  setDay,
  openReviews,
  manageCollaborators,
  leaveTrip,
  editTrip,
  addPlace,
  editPlace,
  openCost,
  onFlightChanged,
  notify,
  initialWorkspaceTab,
  initialView,
  initialAccommodationId,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  day: number;
  setDay: (day: number) => void;
  openReviews: () => void;
  manageCollaborators: () => void;
  leaveTrip: () => void;
  editTrip: () => void;
  addPlace: (day: number, defaultTime?: string) => void;
  editPlace: (item: Itinerary) => void;
  openCost: (
    item?: Itinerary,
    index?: number,
    defaultDay?: number,
    returnToExpenseList?: () => void,
  ) => void;
  onFlightChanged: () => void | Promise<void>;
  notify: (message: string) => void;
  initialWorkspaceTab?: WorkspaceTab;
  initialView?: "plan" | "flights" | "insurance" | "stays";
  initialAccommodationId?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [view, setView] = useState<TripSectionView>(
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
  const [openAccommodationId, setOpenAccommodationId] = useState<string | null>(
    initialAccommodationId || null,
  );
  const [openAccommodationDay, setOpenAccommodationDay] = useState<
    number | null
  >(null);
  const [openTimelineExpenseId, setOpenTimelineExpenseId] = useState<string | null>(null);
  const now = useMinuteClock();
  const tripDay = tripDayAt(trip, now);
  const ended = tripHasEnded(trip, now);
  const itinerariesByDay = useItinerariesByDay(items);
  const hasAccommodations = items.some((item) => Boolean(item.accommodation_id));
  const completion = useTripCompletionStatus(
    trip.id,
    Boolean(trip.has_flights),
    hasAccommodations,
    trip.total_days,
    trip.country_code,
  );
  function selectView(
    nextView: TripSectionView,
    nextWorkspaceTab = activeWorkspaceTab,
  ) {
    setView(nextView);
    if (nextView === "workspace") setActiveWorkspaceTab(nextWorkspaceTab);
    const url = new URL(window.location.href);
    if (nextView === "workspace")
      url.searchParams.set("workspace", nextWorkspaceTab);
    else url.searchParams.delete("workspace");
    if (nextView === "flights" || nextView === "insurance" || nextView === "stays") url.searchParams.set("view", nextView);
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
  const swapDay = async (targetDay: number) => {
    const response = await fetch(`/api/trips/${trip.id}/itineraries/swap-days`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceDay: day, targetDay }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("สลับวันไม่สำเร็จ"));
    await onFlightChanged();
    notify(t("สลับแผนระหว่างวันแล้ว"));
  };
  const nowMinutes = zonedClock(now, trip.timezone).minutes;
  return (
      <div className="screen trip-hub-screen">
      <div className="trip-cover-region">
        <TripHeader
          trip={trip}
          openReviews={openReviews}
          goBack={() => router.back()}
          editTrip={editTrip}
          manageMembers={
            trip.access_role !== "owner"
              ? leaveTrip
              : manageCollaborators
          }
        />
      </div>
      <TripSectionNav
        trip={trip}
        completion={completion}
        active={view}
        workspaceTab={activeWorkspaceTab}
        select={(nextView, nextWorkspaceTab) => selectView(nextView, nextWorkspaceTab)}
      />
      <div className="trip-hub-body">
        {view === "plan" ? (
          <SwipeableTimelineDay day={day} totalDays={trip.total_days} setDay={setDay}>
          {(day) => {
            const dayItems = itinerariesByDay.get(day) || EMPTY_ITINERARIES;
            const currentIndex =
              tripDay === day
                ? dayItems.reduce((found, item, index) => {
                    const start = timeInMinutes(
                      item.start_time ||
                        (item.accommodation_id ? "23:30" : null),
                    );
                    return start !== null && start <= nowMinutes
                      ? index
                      : found;
                  }, -1)
                : -1;
            return (
            <>
            <div className="section-head timeline-heading">
              <TimelineDayPicker
                trip={trip}
                day={day}
                setDay={setDay}
                dateLabel={tripDayLabel(baseDate, day)}
                itemCount={dayItems.length}
                dayCounts={new Map([...itinerariesByDay].map(([number, entries]) => [number, entries.filter((entry) => !entry.accommodation_id).length]))}
                swapDay={trip.access_role === "view" ? undefined : swapDay}
                addPlace={() => addPlace(day)}
              />
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
                  const itemCosts = item.cost_items || [];
                  const itemExpenseTotal = itemCosts.reduce(
                    (total, cost) => total + Number(cost.value || 0),
                    0,
                  );
                  const openTimelineItem = () => {
                    if (item.accommodation_id) {
                      setOpenAccommodationDay(item.day_number);
                      setOpenAccommodationId(item.accommodation_id);
                    } else {
                      editPlace(item);
                    }
                  };
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
                      {previous && (
                        <TimelineInsertPlaceButton
                          previous={previous}
                          next={item}
                          onClick={(defaultTime) => addPlace(day, defaultTime)}
                        />
                      )}
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
                          className={`event-card editable-event-card${itemCosts.length ? " has-expenses" : ""}`}
                        >
                          <div
                            className="event-card-main"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              if (!(event.target as HTMLElement).closest("button,a")) openTimelineItem();
                            }}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openTimelineItem();
                              }
                            }}
                          >
                            <span className={`event-image ${item.image_url||item.location_image_url||item.accommodation_image_url?"":"is-placeholder"}`}>
                              <Image
                                src={item.image_url||item.location_image_url||item.accommodation_image_url||"/travel-postcard-fallback.jpg"}
                                alt={`รูป ${item.place_name}`}
                                fill
                                sizes="108px"
                                unoptimized
                              />
                              <span className="event-time-badge">
                                {item.start_time?.slice(0, 5) ||
                                  (item.accommodation_id
                                    ? "23:30"
                                    : t("ไม่ระบุเวลา"))}
                                {item.accommodation_id && (
                                  <>
                                    {" "}({item.accommodation_night}/
                                    {item.accommodation_nights})
                                  </>
                                )}
                              </span>
                            </span>
                            <div className="event-copy">
                              <div className="timeline-title-row">
                                <h3>{item.place_name}</h3>
                              </div>
                              <AccommodationBookingText
                                platform={item.accommodation_booking_platform}
                              />
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
                              {itemCosts.length > 0 && (
                                <button
                                  type="button"
                                  className="timeline-expense-summary"
                                  onClick={() => setOpenTimelineExpenseId(item.id)}
                                  aria-label={`${t("เปิดรายการค่าใช้จ่าย")} · ${bahtFormat(itemExpenseTotal)} ${t("บาท")}`}
                                >
                                  <WalletCards size={12} aria-hidden="true" />
                                  {t("ค่าใช้จ่ายรวม")} {bahtFormat(itemExpenseTotal)} {t("บาท")}
                                </button>
                              )}
                            </div>
                          </div>
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
                          </div>
                        </article>
                        <TimelineExpenseMenu
                          item={item}
                          openCost={openCost}
                          open={openTimelineExpenseId === item.id}
                          onOpen={() => setOpenTimelineExpenseId(item.id)}
                          onClose={() => setOpenTimelineExpenseId(null)}
                        />
                      </div>
                      {index === dayItems.length - 1 && (
                        <TimelineInsertPlaceButton
                          previous={item}
                          onClick={(defaultTime) => addPlace(day, defaultTime)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </>
            );
          }}
          </SwipeableTimelineDay>
        ) : view === "flights" || view === "insurance" || view === "stays" ? (
          <div className="travel-stay-section">
            {view === "flights" ? <TripFlights
              tripId={trip.id}
              members={trip.members || []}
              tripOutboundAt={trip.outbound_departure_at}
              tripReturnAt={trip.return_departure_at}
              showTravelInsurance={trip.country_code !== "TH"}
              canDelete={trip.access_role !== "view"}
              notify={notify}
              onChanged={onFlightChanged}
              onOpenDocuments={() => selectView("workspace", "documents")}
            /> : view === "insurance" ? <TripInsurance
              tripId={trip.id}
              members={trip.members || []}
              tripOutboundAt={trip.outbound_departure_at}
              tripReturnAt={trip.return_departure_at}
              mode="insurance"
              showTravelInsurance={trip.country_code !== "TH"}
              canDelete={trip.access_role !== "view"}
              notify={notify}
              onChanged={onFlightChanged}
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
            canDelete={trip.access_role !== "view"}
            notify={notify}
            onChanged={onFlightChanged}
          />
        )}
      </div>
      </div>
  );
}

function TimelineScreen({
  trip,
  items,
  cards,
  day,
  setDay,
  addPlace,
  editTrip,
  notify,
  onChanged,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  day: number;
  setDay: (n: number) => void;
  addPlace: (day: number, defaultTime?: string) => void;
  editTrip: () => void;
  notify: (message: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const t = useT();
  const router = useRouter();
  const now = useMinuteClock();
  const tripDay = tripDayAt(trip, now);
  const ended = tripHasEnded(trip, now);
  const itinerariesByDay = useItinerariesByDay(items);
  const hasAccommodations = items.some((item) => Boolean(item.accommodation_id));
  const completion = useTripCompletionStatus(
    trip.id,
    Boolean(trip.has_flights),
    hasAccommodations,
    trip.total_days,
    trip.country_code,
  );
  const [openAccommodationId, setOpenAccommodationId] = useState<string | null>(null);
  const [openAccommodationDay, setOpenAccommodationDay] = useState<number | null>(null);
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
  const swapDay = async (targetDay: number) => {
    const response = await fetch(`/api/trips/${trip.id}/itineraries/swap-days`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceDay: day, targetDay }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("สลับวันไม่สำเร็จ"));
    await onChanged();
    notify(t("สลับแผนระหว่างวันแล้ว"));
  };
  const baseDate = localDate(trip.outbound_departure_at, trip.start_date);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return (
      <div className="screen timeline-screen">
      <div className="trip-cover-region">
        <TripHeader trip={trip} goBack={() => router.back()} editTrip={editTrip} />
      </div>
      <TripSectionNav
        trip={trip}
        completion={completion}
        active="plan"
        select={(section, workspaceTab) => {
          if (section === "plan") return;
          if (section === "expenses") router.push(`/trips/${trip.id}/expenses`);
          else if (section === "workspace") router.push(`/trips/${trip.id}?workspace=${workspaceTab || "checklist"}`);
          else router.push(`/trips/${trip.id}?view=${section}`);
        }}
      />
      <SwipeableTimelineDay day={day} totalDays={trip.total_days} setDay={setDay}>
      {(day) => {
        const dayItems = itinerariesByDay.get(day) || EMPTY_ITINERARIES;
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
      <div className="section-head timeline-heading">
        <TimelineDayPicker
          trip={trip}
          day={day}
          setDay={setDay}
          dateLabel={tripDayLabel(baseDate, day)}
          itemCount={dayItems.length}
          dayCounts={new Map([...itinerariesByDay].map(([number, entries]) => [number, entries.filter((entry) => !entry.accommodation_id).length]))}
          swapDay={trip.access_role === "view" ? undefined : swapDay}
          addPlace={() => addPlace(day)}
        />
      </div>
      {dayItems.length === 0 ? (
        <EmptyState
          title={t(`Day ${displayTripDay(trip, day)} ยังว่างอยู่`)}
          description={t("เพิ่มสถานที่ เวลา และวิธีเดินทางสำหรับวันนี้")}
          action={t("เพิ่มสถานที่")}
          onClick={() => addPlace(day)}
        />
      ) : (
        <div className="timeline">
          {dayItems.map((item, index) => {
            const isCurrent = index === currentIndex;
            const isPast =
              tripDay !== null &&
              (tripDay > day ||
                (tripDay === day && currentIndex >= 0 && index < currentIndex));
            const previous = index > 0 ? dayItems[index - 1] : null;
            return (
              <div
                className={`timeline-stop ${item.accommodation_id ? "accommodation-stop" : ""} ${isCurrent ? "current-stop" : ""} ${isPast ? "past-stop" : ""}`}
                key={item.id}
              >
                {previous && (
                  <TimelineInsertPlaceButton
                    previous={previous}
                    next={item}
                    onClick={(defaultTime) => addPlace(day, defaultTime)}
                  />
                )}
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
                        {item.start_time?.slice(0, 5) ||
                          (item.accommodation_id
                            ? "23:30"
                            : t("ไม่ระบุเวลา"))}
                        {item.accommodation_id && (
                          <>
                            {" "}({item.accommodation_night}/
                            {item.accommodation_nights})
                          </>
                        )}
                      </span>
                      <AccommodationBookingText
                        platform={item.accommodation_booking_platform}
                      />
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
                {index === dayItems.length - 1 && (
                  <TimelineInsertPlaceButton
                    previous={item}
                    onClick={(defaultTime) => addPlace(day, defaultTime)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
        );
      }}
      </SwipeableTimelineDay>
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
  );
}

function CategoryDonut({
  categories,
  total,
  selectedCategory,
  onSelectedCategoryChange,
}: {
  categories: Array<[string, number]>;
  total: number;
  selectedCategory: string | null;
  onSelectedCategoryChange: (category: string | null) => void;
}) {
  const t = useT();
  const [previewCategory, setPreviewCategory] = useState<string | null>(null);
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
  const selectedIndex = selectedCategory
    ? segments.findIndex((segment) => segment.category === selectedCategory)
    : null;
  const active = previewCategory
    ? segments.find((segment) => segment.category === previewCategory) || null
    : selectedCategory
      ? segments.find((segment) => segment.category === selectedCategory) || null
      : null;
  const money = (amount: number) => bahtFormat(amount);
  const selectCategory = (category: string) =>
    onSelectedCategoryChange(selectedCategory === category ? null : category);
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
                onMouseEnter={() => setPreviewCategory(segment.category)}
                onMouseLeave={() => setPreviewCategory(null)}
                onFocus={() => setPreviewCategory(segment.category)}
                onBlur={() => setPreviewCategory(null)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  selectCategory(segment.category);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectCategory(segment.category);
                  }
                }}
              >
                <title>{`${t(segment.category)} · ฿${money(segment.amount)} · ${segment.percent.toFixed(1)}%`}</title>
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
                <span>{t(segments.length ? "ทั้งหมด" : "ยังไม่มีค่าใช้จ่าย")}</span>
                <strong>฿{money(total)}</strong>
                {segments.length > 0 && <small>100%</small>}
              </>
            )}
          </div>
        </div>
        <div className="donut-legend">
          {segments.length ? (
            <>
              <button
                type="button"
                className={`donut-legend-all ${selectedCategory === null ? "active" : ""}`}
                onMouseEnter={() => setPreviewCategory(null)}
                onFocus={() => setPreviewCategory(null)}
                onClick={() => onSelectedCategoryChange(null)}
                aria-pressed={selectedCategory === null}
              >
                <i />
                <span>
                  <b>{t("ทั้งหมด")}</b>
                  <small>100%</small>
                </span>
                <strong>฿{money(total)}</strong>
              </button>
              {segments.map((segment) => (
                <button
                  type="button"
                  key={segment.category}
                  className={selectedIndex === segment.index ? "active" : ""}
                  onMouseEnter={() => setPreviewCategory(segment.category)}
                  onMouseLeave={() => setPreviewCategory(null)}
                  onFocus={() => setPreviewCategory(segment.category)}
                  onBlur={() => setPreviewCategory(null)}
                  onClick={() => selectCategory(segment.category)}
                  aria-pressed={selectedIndex === segment.index}
                >
                  <i style={{ background: segment.color }} />
                  <span>
                    <b>{t(segment.category)}</b>
                    <small>{segment.percent.toFixed(1)}%</small>
                  </span>
                  <strong>฿{money(segment.amount)}</strong>
                </button>
              ))}
            </>
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(
    () => new Set(),
  );
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
  const toggleDay = (dayNumber: number) =>
    setCollapsedDays((current) => {
      const next = new Set(current);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
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
      <CategoryDonut
        categories={categories}
        total={total}
        selectedCategory={selectedCategory}
        onSelectedCategoryChange={setSelectedCategory}
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
            const isCollapsed = collapsedDays.has(dayNumber);
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
                    <button
                      type="button"
                      className="expense-day-chevron"
                      onClick={() => toggleDay(dayNumber)}
                      aria-label={t(isCollapsed ? "ขยาย" : "ย่อ")}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>
                {!isCollapsed && (count === 0 ? (
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
                        const splitLabel = costSplitLabel(cost, trip.traveller_count);
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
                              {splitLabel ? <small className="expense-row-split">{splitLabel}</small> : null}
                            </span>
                          </button>
                        );
                      }),
                    )}
                  </div>
                ))}
              </section>
            );
          },
        )}
      </div>
    </div>
  );
}

function expenseCategoryTone(category?: string | null) {
  const normalized = (category || "อื่น ๆ").trim().toLocaleLowerCase();
  let tone = "other";
  if (
    normalized.includes("อาหาร") ||
    normalized.includes("กิน") ||
    normalized.includes("food")
  ) {
    tone = "food";
  } else if (
    normalized.includes("เดินทาง") ||
    normalized.includes("transport")
  ) {
    tone = "transport";
  } else if (normalized.includes("ที่พัก") || normalized.includes("hotel")) {
    tone = "stay";
  } else if (
    normalized.includes("เครื่องบิน") ||
    normalized.includes("flight")
  ) {
    tone = "flight";
  } else if (
    normalized.includes("กิจกรรม") ||
    normalized.includes("ticket")
  ) {
    tone = "activity";
  } else if (
    normalized.includes("shopping") ||
    normalized.includes("ช้อป") ||
    normalized.includes("ของฝาก")
  ) {
    tone = "shopping";
  }
  return tone;
}

function ExpenseCategoryIcon({ category }: { category?: string | null }) {
  const tone = expenseCategoryTone(category);
  const Icon =
    tone === "food"
      ? Utensils
      : tone === "transport"
        ? CarFront
        : tone === "stay"
          ? BedDouble
          : tone === "flight"
            ? Plane
            : tone === "activity"
              ? Ticket
              : tone === "shopping"
                ? ShoppingBag
                : ReceiptText;
  return (
    <i className={`expense-category-icon is-${tone}`} aria-hidden="true">
      <Icon size={20} strokeWidth={2.5} />
    </i>
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
  const totalBudget = tripBudget + shoppingBudget;
  const totalSpent = tripTotal + shoppingTotal;
  const remaining = totalBudget - totalSpent;
  const totalPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const boundedPercent = Math.min(Math.max(totalPercent, 0), 100);
  return (
    <section className={`expense-overview ${remaining < 0 ? "is-over-budget" : ""}`}>
      <div className="expense-overview-stats">
        <article className="is-budget">
          <WalletCards size={18} />
          <span>{t("งบประมาณรวม")}</span>
          <strong>฿{bahtFormat(totalBudget)}</strong>
        </article>
        <article className="is-spent">
          <WalletCards size={18} />
          <span>{t("ใช้ไปแล้ว")}</span>
          <strong>฿{bahtFormat(totalSpent)}</strong>
          <small>{totalPercent.toFixed(0)}%</small>
        </article>
        <article className="is-remaining">
          <ChartNoAxesColumnIncreasing size={18} />
          <span>{t(remaining < 0 ? "เกินงบ" : "คงเหลือ")}</span>
          <strong>฿{bahtFormat(Math.abs(remaining))}</strong>
          <small>{totalBudget > 0 ? Math.abs(100 - totalPercent).toFixed(0) : "0"}%</small>
        </article>
      </div>
      <div className="expense-overview-progress">
        <div
          className="expense-progress-ring"
          style={{ "--expense-progress": `${boundedPercent * 3.6}deg` } as CSSProperties}
          role="progressbar"
          aria-label={`${t("ใช้ไปแล้ว")} ${totalPercent.toFixed(0)}%`}
          aria-valuenow={Math.round(boundedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span>{totalPercent.toFixed(0)}%</span>
        </div>
        <div>
          <p>{t("ใช้ไปแล้ว")} ฿{bahtFormat(totalSpent)} {t("จาก")} ฿{bahtFormat(totalBudget)}</p>
          <div className="expense-overview-bar"><i style={{ width: `${boundedPercent}%` }} /></div>
          <small>{t(remaining < 0 ? "เกินงบ" : "ยังอยู่ในงบประมาณ")} <CheckCircle2 size={13} /></small>
        </div>
      </div>
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
  guests,
}: {
  costs: CostItem[];
  members: TripMember[];
  guests: ExpenseGuest[];
}) {
  const t = useT();
  const orderedMembers = ownerLastTripMembers(members);
  const memberIds = new Set(orderedMembers.map((member) => member.id));
  const guestIds = new Set(guests.map((guest) => guest.id));
  const memberTotals = new Map(
    orderedMembers.map((member) => [
      member.id,
      { trip: 0, shopping: 0 },
    ]),
  );
  const guestTotals = new Map(
    guests.map((guest) => [guest.id, { trip: 0, shopping: 0 }]),
  );
  for (const cost of costs) {
    const hasExplicitMembers = Array.isArray(cost.splitMemberIds);
    const selectedMembers = (cost.splitMemberIds || []).filter((id) =>
      memberIds.has(id),
    );
    const selectedGuests = (cost.splitGuestIds || []).filter((id) =>
      guestIds.has(id),
    );
    const participants = hasExplicitMembers
      ? selectedMembers
      : orderedMembers.map((member) => member.id);
    const divisor = costSplitCount(
      cost,
      participants.length + selectedGuests.length,
    );
    if (!participants.length && !selectedGuests.length) continue;
    const share = Number(cost.value || 0) / divisor;
    const shopping = (cost.category || "").toLowerCase() === "shopping";
    for (const memberId of participants) {
      const total = memberTotals.get(memberId);
      if (!total) continue;
      if (shopping) total.shopping += share;
      else total.trip += share;
    }
    for (const guestId of selectedGuests) {
      const total = guestTotals.get(guestId);
      if (!total) continue;
      if (shopping) total.shopping += share;
      else total.trip += share;
    }
  }
  if (!orderedMembers.length && !guests.length) return null;
  const rows = [
    ...orderedMembers.map((member) => ({
      id: `member:${member.id}`,
      label: member.display_name || member.email || "-",
      avatarUrl: member.avatar_url,
      guest: false,
      total: memberTotals.get(member.id) || { trip: 0, shopping: 0 },
    })),
    ...guests.map((guest) => ({
      id: `guest:${guest.id}`,
      label: guest.name,
      avatarUrl: null,
      guest: true,
      total: guestTotals.get(guest.id) || { trip: 0, shopping: 0 },
    })),
  ];
  return (
    <section className="expense-member-summary">
      <div className="expense-member-summary-head">
        <h3>{t("สรุปค่าใช้จ่ายแยกตามคน")}</h3>
        <p>{t("รวมทั้งสมาชิกในทริปและคนนอกที่เลือกหาร")}</p>
      </div>
      <div>
        {rows.map((row) => {
          return (
            <article key={row.id}>
              <span
                className={`expense-member-avatar ${row.guest ? "is-guest" : ""}`}
                style={
                  row.avatarUrl
                    ? { backgroundImage: `url("${row.avatarUrl}")` }
                    : undefined
                }
              >
                {row.guest ? (
                  <UserRound size={19} aria-hidden="true" />
                ) : (
                  !row.avatarUrl && row.label.charAt(0).toUpperCase()
                )}
              </span>
              <div className="expense-member-copy">
                <strong>{row.label}</strong>
                <small>{t(row.guest ? "คนนอกทริป" : "รวมที่ต้องรับผิดชอบ")}</small>
              </div>
              <div className="expense-member-totals">
                <span>
                  {t("ค่าใช้จ่ายทริป")} <b>฿{bahtFormat(row.total.trip)}</b>
                </span>
                <span>
                  {t("ค่า Shopping")} <b>฿{bahtFormat(row.total.shopping)}</b>
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
  const { guests: expenseGuests } = useExpenseGuests(trip.id);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(
    () => new Set(),
  );
  const allCosts = items.flatMap((item) => item.cost_items || []);
  const isShopping = (cost: CostItem) =>
    (cost.category || "").toLowerCase() === "shopping";
  const tripCosts = allCosts.filter((cost) => !isShopping(cost));
  const shoppingCosts = allCosts.filter(isShopping);
  const tripTotal = tripCosts.reduce(
    (sum, cost) => sum + Number(cost.value || 0),
    0,
  );
  const shoppingTotal = shoppingCosts.reduce(
    (sum, cost) => sum + Number(cost.value || 0),
    0,
  );
  const categories = Array.from(
    allCosts.reduce(
      (map, cost) =>
        map.set(
          cost.category || "อื่น ๆ",
          (map.get(cost.category || "อื่น ๆ") || 0) + Number(cost.value || 0),
        ),
      new Map<string, number>(),
    ),
  ).sort((a, b) => b[1] - a[1]);
  const grandTotal = tripTotal + shoppingTotal;
  const selectedCategoryTotal = selectedCategory
    ? categories.find(([category]) => category === selectedCategory)?.[1] || 0
    : 0;
  const availableDays = Array.from(
    new Set(items.map((item) => item.day_number)),
  ).sort((a, b) => a - b);
  const firstAvailableDay = availableDays[0];
  const toggleDay = (dayNumber: number) =>
    setCollapsedDays((current) => {
      const next = new Set(current);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  return (
    <div className="plan-expenses redesigned-plan-expenses">
      <TripSectionHeading
        className="expense-page-heading"
        title={t("ค่าใช้จ่าย")}
        subtitle={t("สรุปค่าใช้จ่ายทั้งหมดของทริป")}
        actions={<button
          type="button"
          className="trip-section-add"
          disabled={!firstAvailableDay}
          title={t(firstAvailableDay ? "เพิ่มค่าใช้จ่าย" : "ต้องเพิ่ม Timeline ก่อน")}
          aria-label={t(firstAvailableDay ? "เพิ่มค่าใช้จ่าย" : "ต้องเพิ่ม Timeline ก่อน")}
          onClick={() => firstAvailableDay && openCost(undefined, undefined, firstAvailableDay)}
        >
          <Plus size={21} />
          <span>{t("เพิ่มค่าใช้จ่าย")}</span>
        </button>}
      />
      <ExpenseSplitSummary
        trip={trip}
        tripTotal={tripTotal}
        shoppingTotal={shoppingTotal}
      />
      <CategoryDonut
        categories={categories}
        total={grandTotal}
        selectedCategory={selectedCategory}
        onSelectedCategoryChange={setSelectedCategory}
      />
      <details className="expense-insight-details">
        <summary>
          <span><ChartNoAxesColumnIncreasing size={17} />{t("ดูรายละเอียด")}</span>
          <ChevronDown size={17} />
        </summary>
        <div>
          <PaymentMethodSummary costs={allCosts} cards={cards} />
          <ExpenseMemberSummary
            costs={allCosts}
            members={trip.members || []}
            guests={expenseGuests}
          />
        </div>
      </details>
      <div className="expense-list-heading">
        <span><CalendarDays size={18} /></span>
        <h2>{t("รายการค่าใช้จ่าย")}</h2>
      </div>
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
            const visibleDayCosts = selectedCategory
              ? dayCosts.filter(
                  (cost) => (cost.category || "อื่น ๆ") === selectedCategory,
                )
              : dayCosts;
            const dayTripTotal = dayCosts
              .filter((cost) => !isShopping(cost))
              .reduce((sum, cost) => sum + Number(cost.value || 0), 0);
            const dayShoppingTotal = dayCosts
              .filter(isShopping)
              .reduce((sum, cost) => sum + Number(cost.value || 0), 0);
            const selectedDayTotal = visibleDayCosts.reduce(
              (sum, cost) => sum + Number(cost.value || 0),
              0,
            );
            const count = visibleDayCosts.length;
            const isCollapsed = collapsedDays.has(dayNumber);
            const dayGrandTotal = dayTripTotal + dayShoppingTotal;
            return (
              <section
                className={`expense-day-card ${dayItems.length ? "" : "without-timeline"} ${isCollapsed ? "is-collapsed" : ""}`}
                key={dayNumber}
              >
                <div className="expense-day-head">
                  <button
                    type="button"
                    className="expense-day-toggle"
                    onClick={() => toggleDay(dayNumber)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{tripDayLabel(localDate(trip.outbound_departure_at, trip.start_date), dayNumber)}</span>
                    <small>DAY {displayTripDay(trip, dayNumber)} · {t(`${count} รายการ`)}</small>
                  </button>
                  <div className="expense-day-actions">
                    {selectedCategory ? (
                      <div className="day-split-total is-category-filtered">
                        <span>
                          {t(selectedCategory)}{" "}
                          <strong>฿{bahtFormat(selectedDayTotal)}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="day-split-total">
                        <span>
                          {t("รวมค่าใช้จ่าย")}{" "}
                          <strong>฿{bahtFormat(dayGrandTotal)}</strong>
                        </span>
                        <small>{t("ค่าใช้จ่ายทริป")} ฿{bahtFormat(dayTripTotal)} · {t("ค่า Shopping")} ฿{bahtFormat(dayShoppingTotal)}</small>
                      </div>
                    )}
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
                    <button
                      type="button"
                      className="expense-day-chevron"
                      onClick={() => toggleDay(dayNumber)}
                      aria-label={t(isCollapsed ? "ขยาย" : "ย่อ")}
                      aria-expanded={!isCollapsed}
                    >
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                  </div>
                </div>
                {!isCollapsed && (count === 0 ? (
                  <p className="expense-day-empty">
                    {t(
                      selectedCategory
                        ? `${t("วันนี้ไม่มีค่าใช้จ่ายหมวด")} ${t(selectedCategory)}`
                        : dayItems.length
                          ? "ยังไม่มีราคาที่กรอกในวันนี้"
                          : "ยังไม่มี Timeline ในวันนี้",
                    )}
                  </p>
                ) : (
                  <div className="expense-day-list">
                    {dayItems.flatMap((item) =>
                      (item.cost_items || []).map((cost, costIndex) => {
                        if (
                          selectedCategory &&
                          (cost.category || "อื่น ๆ") !== selectedCategory
                        )
                          return null;
                        const isBaht = (cost.currency || "THB") === "THB";
                        const card = findPaymentCard(cards, cost);
                        const splitLabel = costSplitLabel(cost, trip.traveller_count);
                        return (
                          <button
                            type="button"
                            className="expense-plan-row"
                            key={cost.id || `${item.id}-${costIndex}`}
                            onClick={() => openCost(item, costIndex)}
                          >
                            <ExpenseCategoryIcon category={cost.category} />
                            <div className="expense-plan-copy">
                              <strong>{cost.key}</strong>
                              <small>
                                {item.place_name} · {item.start_time?.slice(0, 5) || "--:--"}
                              </small>
                            </div>
                            <small className={`expense-category-pill is-${expenseCategoryTone(cost.category)}`}>
                              {t(cost.category || "อื่น ๆ")}
                            </small>
                            <span className="expense-plan-amount">
                              <b>
                                {isBaht ? "" : "≈ "}฿{bahtFormat(cost.value)}
                              </b>
                              {!isBaht && (
                                <small>{costSourceLabel(cost)}</small>
                              )}
                              {splitLabel ? <small className="expense-row-split">{splitLabel}</small> : null}
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
                ))}
              </section>
            );
          },
        )}
      </div>
      {selectedCategory && typeof document !== "undefined" && createPortal(
        <button
          type="button"
          className="expense-filter-fab"
          onClick={() => setSelectedCategory(null)}
          title={t("กดเพื่อแสดงทั้งหมด")}
          aria-label={`${t(selectedCategory)} ฿${bahtFormat(selectedCategoryTotal)} — ${t("กดเพื่อแสดงทั้งหมด")}`}
        >
          <span className="expense-filter-fab-copy">
            <strong>{t(selectedCategory)}</strong>
            <b>฿{bahtFormat(selectedCategoryTotal)}</b>
          </span>
          <X size={16} aria-hidden="true" />
        </button>,
        document.body,
      )}
    </div>
  );
}

function ExpensesScreen({
  trip,
  items,
  cards,
  openCost,
  editTrip,
}: {
  trip: Trip;
  items: Itinerary[];
  cards: PaymentCard[];
  openCost: (item?: Itinerary, index?: number, defaultDay?: number) => void;
  editTrip: () => void;
}) {
  const router = useRouter();
  const hasAccommodations = items.some((item) => Boolean(item.accommodation_id));
  const completion = useTripCompletionStatus(
    trip.id,
    Boolean(trip.has_flights),
    hasAccommodations,
    trip.total_days,
    trip.country_code,
  );
  return (
    <ExpenseTripMembersContext.Provider value={trip.members || []}>
      <div className="screen trip-hub-screen">
        <div className="trip-cover-region">
          <TripHeader trip={trip} goBack={() => router.back()} editTrip={editTrip} />
        </div>
        <TripSectionNav
          trip={trip}
          completion={completion}
          active="expenses"
          select={(section, workspaceTab) => {
            if (section === "expenses") return;
            router.push(
              section === "plan"
                ? `/trips/${trip.id}`
                : section === "workspace"
                  ? `/trips/${trip.id}?workspace=${workspaceTab || "checklist"}`
                : `/trips/${trip.id}?view=${section}`,
            );
          }}
        />
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

function SettingsGlass({ children }: { children: ReactNode }) {
  return (
    <LiquiGlass
      className="settings-liquid-glass"
      contentClassName="settings-liquid-glass-content"
      radius={20}
      blur={1.5}
      refraction={58}
      bezel={14}
    >
      {children}
    </LiquiGlass>
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
    <SettingsGlass>
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
    </SettingsGlass>
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
    <SettingsGlass>
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
    </SettingsGlass>
  );
}

function SettingsContent({
  dark,
  toggleTheme,
  lang,
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
        <SettingsGlass>
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
        </SettingsGlass>
        <SettingsGlass>
        <a className="card master-settings-link" href="/settings/checklists?returnTo=%2Fsettings">
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
        </SettingsGlass>
        <SettingsGlass>
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
        </SettingsGlass>
        <SettingsGlass>
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
        </SettingsGlass>
        <SettingsGlass>
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
        </SettingsGlass>
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

export function ConfirmDialog({
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

export function CoverImagePicker({
  existingUrl,
  onChange,
  variant = "cover",
  removable = false,
}: {
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
  variant?: "cover" | "square";
  removable?: boolean;
}) {
  const t = useT();
  const square = variant === "square";
  const outputWidth = square ? 640 : 1600;
  const outputHeight = square ? 640 : 900;
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
        outputWidth / source.image.naturalWidth,
        outputHeight / source.image.naturalHeight,
      ) * nextZoom;
    return {
      x: Math.max(0, (source.image.naturalWidth * scale - outputWidth) / 2),
      y: Math.max(0, (source.image.naturalHeight * scale - outputHeight) / 2),
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
    canvas.width = outputWidth;
    canvas.height = outputHeight;
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
  }, [source, zoom, offset, outputWidth, outputHeight]);
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
    const ratio = outputWidth / rect.width;
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
        quality: square ? 0.78 : 0.86,
        minQuality: square ? 0.66 : 0.74,
        targetBytes: square ? 180 * 1024 : 900 * 1024,
        suffix: square ? "timeline" : "cover",
      });
    } catch {
      setError("ไม่สามารถ Crop รูปได้");
      return;
    }
    const url = URL.createObjectURL(croppedFile);
    objectUrls.current.push(url);
    setPreview(url);
    setCropping(false);
    setSource(null);
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
  function removeImage() {
    pointers.current.clear();
    dragStart.current = null;
    pinchStart.current = null;
    setPreview("");
    setCropping(false);
    setSource(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
  }
  const cropEditor = cropping ? (
    <div
      className="crop-editor"
      role="dialog"
      aria-modal="true"
      aria-label={t(square ? "ครอบรูปสถานที่" : "ครอบรูปหน้าปก")}
    >
      <header>
        <button type="button" onClick={cancelCrop} aria-label={t("ยกเลิก")}>
          <X size={20} />
        </button>
        <div>
          <strong>{t(square ? "ครอบรูปสถานที่" : "ครอบรูปหน้าปก")}</strong>
          <small>{t("ลากด้วยหนึ่งนิ้ว · จีบเข้า–ออกด้วยสองนิ้ว")}</small>
        </div>
        <span />
      </header>
      <main>
        <div className={`fixed-crop-frame ${square ? "is-square" : ""}`}>
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
          <span className="crop-ratio">{square ? "1 : 1" : "16 : 9"}</span>
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
    <div className={`cover-picker ${square ? "square-picker" : ""}`}>
      {!cropping && (
        <label
          className={`upload-field cover-upload ${preview ? "selected" : ""}`}
        >
          <span className="upload-preview">
            {preview && (
              <Image
                src={preview}
                alt={t(square ? "รูปสถานที่ที่เลือก" : "รูปหน้าปกที่เลือก")}
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
                t(square ? "เพิ่มรูปสถานที่" : "เพิ่มรูปหน้าปก")
              )}
            </strong>
            <small>
              {t(
                preview
                  ? "พร้อมอัปโหลดเมื่อกดบันทึก · แตะเพื่อเลือกและครอบรูปใหม่"
                  : square
                    ? "เลือกภาพ แล้วจัดตำแหน่งในกรอบสี่เหลี่ยมจัตุรัส"
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
      {removable && preview && !cropping && (
        <button
          type="button"
          className="cover-picker-remove"
          onClick={removeImage}
          aria-label={t("ลบรูปสถานที่")}
        >
          <Trash2 size={16} />
        </button>
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
  notify,
  onChanged,
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
  notify: (message: string) => void;
  onChanged: () => void | Promise<void>;
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
  const { guests: expenseGuests, setGuests: setExpenseGuests } =
    useExpenseGuests(trip.id);
  const [guestName, setGuestName] = useState("");
  const [addingGuest, setAddingGuest] = useState(false);
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [guestDeleteTarget, setGuestDeleteTarget] = useState<{
    guest: ExpenseGuest;
    affectedCosts: number;
    affectedTotal: number;
    reassignedToOwner: number;
  } | null>(null);
  const splitMembers = ownerLastTripMembers(trip.members || []);
  const allSplitMemberIds = splitMembers.map((member) => member.id);
  const existingSplitMemberIds = (existing?.splitMemberIds || []).filter(
    (id) => allSplitMemberIds.includes(id),
  );
  const [splitMemberIds, setSplitMemberIds] = useState<string[]>(
    existing && Array.isArray(existing.splitMemberIds)
      ? existingSplitMemberIds
      : allSplitMemberIds,
  );
  const [splitGuestIds, setSplitGuestIds] = useState<string[]>(
    existing?.splitGuestIds || [],
  );
  const initializedGuestSelection = useRef(Boolean(existing));
  useEffect(() => {
    if (initializedGuestSelection.current || !expenseGuests.length) return;
    initializedGuestSelection.current = true;
    setSplitGuestIds(expenseGuests.map((guest) => guest.id));
  }, [expenseGuests]);
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
  async function addExpenseGuest() {
    const name = guestName.trim();
    if (!name || addingGuest) return;
    setAddingGuest(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${trip.id}/expense-guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "เพิ่มคนนอกทริปไม่สำเร็จ");
      const guest = data as ExpenseGuest;
      setExpenseGuests((current) =>
        current.some((item) => item.id === guest.id)
          ? current
          : [...current, guest],
      );
      setSplitGuestIds((current) => [...new Set([...current, guest.id])]);
      setGuestName("");
      window.dispatchEvent(
        new CustomEvent(EXPENSE_GUESTS_CHANGED_EVENT, {
          detail: { tripId: trip.id },
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "เพิ่มคนนอกทริปไม่สำเร็จ",
      );
    } finally {
      setAddingGuest(false);
    }
  }
  function requestDeleteExpenseGuest(guest: ExpenseGuest) {
    const linkedCosts = items
      .flatMap((item) => item.cost_items || [])
      .filter((cost) => cost.splitGuestIds?.includes(guest.id));
    setSplitPickerOpen(false);
    setGuestDeleteTarget({
      guest,
      affectedCosts: linkedCosts.length,
      affectedTotal: linkedCosts.reduce(
        (sum, cost) => sum + Number(cost.value || 0),
        0,
      ),
      reassignedToOwner: linkedCosts.filter(
        (cost) =>
          (cost.splitMemberIds?.length || 0) +
            (cost.splitGuestIds?.length || 0) ===
          1,
      ).length,
    });
  }
  async function deleteExpenseGuest(guest: ExpenseGuest) {
    if (deletingGuestId) return;
    setDeletingGuestId(guest.id);
    setError("");
    try {
      const response = await fetch(
        `/api/trips/${trip.id}/expense-guests/${guest.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ลบคนนอกทริปไม่สำเร็จ");
      setExpenseGuests((current) =>
        current.filter((item) => item.id !== guest.id),
      );
      setSplitGuestIds((current) => current.filter((id) => id !== guest.id));
      window.dispatchEvent(
        new CustomEvent(EXPENSE_GUESTS_CHANGED_EVENT, {
          detail: { tripId: trip.id },
        }),
      );
      await onChanged();
      notify(
        data.affectedCosts
          ? `ลบ ${guest.name} แล้ว · คำนวณค่าใช้จ่ายใหม่ ${data.affectedCosts} รายการ`
          : `ลบ ${guest.name} แล้ว`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบคนนอกทริปไม่สำเร็จ");
      throw err;
    } finally {
      setDeletingGuestId(null);
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
    if (splitMemberIds.length + splitGuestIds.length < 1) {
      setError("กรุณาเลือกอย่างน้อย 1 คนสำหรับหารค่าใช้จ่าย");
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
      splitMemberIds,
      splitGuestIds,
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
    <>
      <BottomSheet
        title={t(existing ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย")}
        subtitle={t(
          existing
            ? "แก้ไขหรือย้ายรายการไปยัง Timeline อื่นได้"
            : "เลือกรายการในแพลนที่ค่าใช้จ่ายนี้เกิดขึ้น",
        )}
        closeLabel={t("ยกเลิก")}
        onClose={close}
        onSubmit={handle}
        formRef={formRef}
        onChange={checkForChanges}
        busy={saving}
        className="cost-sheet"
        submitLabel={t(saving ? "กำลังบันทึก…" : "บันทึกค่าใช้จ่าย")}
        submitDisabled={saving || rateLoading || !targetId || !hasChanges}
        onDelete={canDelete && existing && modal.item && modal.costIndex !== undefined ? () => setConfirmDelete(true) : undefined}
        deleteDisabled={saving}
        deleteLabel={t("ลบค่าใช้จ่ายนี้")}
      >
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
                      <button
                        type="button"
                        className="split-guest-delete"
                        onClick={() => requestDeleteExpenseGuest(guest)}
                        disabled={Boolean(deletingGuestId)}
                        aria-label={`${t("ลบ")} ${guest.name}`}
                        title={t("ลบคนนอกทริป")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
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
                    >
                      {addingGuest ? t("กำลังเพิ่ม…") : t("เพิ่ม")}
                    </button>
                  </div>
                </div>
              )}
              <small>{t("เพิ่มคนนอกได้โดยไม่ต้องเชิญอีเมลหรือจอยทริป")}</small>
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
      </BottomSheet>
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
      {guestDeleteTarget && (
        <ConfirmDialog
          confirmation={{
            title: `ลบ “${guestDeleteTarget.guest.name}” ออกจากทริป?`,
            description:
              guestDeleteTarget.affectedCosts > 0
                ? `ชื่อนี้จะหายจากผู้หาร ${guestDeleteTarget.affectedCosts} รายการ รวมยอด ฿${bahtFormat(guestDeleteTarget.affectedTotal)} และระบบจะคำนวณส่วนหารใหม่ทั้งหมด การเชื่อมโยงชื่อจะหายไปแต่รายการค่าใช้จ่ายยังอยู่${guestDeleteTarget.reassignedToOwner > 0 ? ` โดย ${guestDeleteTarget.reassignedToOwner} รายการที่มีชื่อนี้เป็นผู้หารคนเดียวจะย้ายยอดให้เจ้าของทริป` : ""}`
                : "รายชื่อนี้ยังไม่เชื่อมกับค่าใช้จ่าย จึงลบได้โดยไม่กระทบยอดรายการอื่น",
            confirmLabel: "ลบและคำนวณใหม่",
            busyLabel: "กำลังลบและคำนวณ…",
            onConfirm: () => deleteExpenseGuest(guestDeleteTarget.guest),
          }}
          close={() => setGuestDeleteTarget(null)}
        />
      )}
    </>
  );
}

function TripLocationInput({
  items,
  currentItem,
  onSelectPlace,
  onAddressChange,
}: {
  items: Itinerary[];
  currentItem?: Itinerary;
  onSelectPlace: (item: Itinerary) => void;
  onAddressChange?: () => void;
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
  const selectSuggestion = (item: Itinerary) => {
    setValue(item.address!.trim());
    onSelectPlace(item);
    setOpen(false);
  };
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
          onAddressChange?.();
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
              onPointerDown={(event) => {
                event.preventDefault();
                selectSuggestion(item);
              }}
              onClick={() => selectSuggestion(item)}
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

export function TripDestinationPicker({
  countryCode,
  selected,
  onChange,
}: {
  countryCode: string;
  selected: TripDestinationOption[];
  onChange: (items: TripDestinationOption[]) => void;
}) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return TRIP_DESTINATION_OPTIONS.filter((option) =>
      option.countryCode === countryCode &&
      !selected.some((item) => item.id === option.id) &&
      (!normalized || [option.nameTh, option.nameEn, ...option.searchTerms].some((term) => term.toLowerCase().includes(normalized)))
    ).slice(0, 12);
  }, [countryCode, query, selected]);
  const optionLabel = (option: TripDestinationOption) =>
    lang === "EN" ? option.nameEn : option.nameTh;
  const matchesQuery = (option: TripDestinationOption, value: string) =>
    [option.nameTh, option.nameEn, ...option.searchTerms].some(
      (term) => term.trim().toLowerCase() === value.trim().toLowerCase(),
    );
  const add = (option: TripDestinationOption) => {
    if (!selected.some((item) => item.id === option.id)) onChange([...selected, option]);
    setQuery(optionLabel(option));
    setFocused(false);
  };
  const commitQuery = () => {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const alreadySelected = selected.find((option) => matchesQuery(option, normalized));
    if (alreadySelected) {
      setQuery(optionLabel(alreadySelected));
      setFocused(false);
      return;
    }
    const exact = options.find((option) =>
      matchesQuery(option, normalized),
    );
    const custom = exact || createCustomTripDestination(countryCode, normalized);
    if (custom) add(custom);
  };
  const canAddCustom = Boolean(query.trim()) && !options.some((option) =>
    [option.nameTh, option.nameEn, ...option.searchTerms].some(
      (term) => term.trim().toLowerCase() === query.trim().toLowerCase(),
    ),
  );
  return (
    <div className="field trip-destination-picker">
      <label>{t("เมือง / จังหวัดที่ไป")}</label>
      {selected.map((option) => <input key={`hidden-${option.id}`} type="hidden" name="locationIds" value={option.id} />)}
      <div className="trip-destination-control">
        {selected.length > 0 && (
          <div className="trip-destination-chips">
            {selected.map((option) => (
              <span key={option.id}>
                <b>{lang === "EN" ? option.nameEn : option.nameTh}</b>
                <button type="button" onClick={() => onChange(selected.filter((item) => item.id !== option.id))} aria-label={`${t("ลบ")} ${option.nameTh}`}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="trip-destination-search">
          <Search size={16} />
          <input
            value={query}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            onFocus={() => {
              if (selected.some((option) => matchesQuery(option, query))) setQuery("");
              setFocused(true);
            }}
            onBlur={() => {
              commitQuery();
              window.setTimeout(() => setFocused(false), 120);
            }}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                event.preventDefault();
                commitQuery();
              }
            }}
            maxLength={80}
            placeholder={t("ค้นหาเมืองหรือจังหวัด")}
            role="combobox"
            aria-expanded={focused}
            aria-controls="trip-destination-options"
          />
        </div>
        {focused && (
          <div id="trip-destination-options" className="trip-destination-options" role="listbox">
            {options.map((option) => (
              <button type="button" role="option" aria-selected="false" key={option.id} onPointerDown={(event) => { event.preventDefault(); add(option); }} onClick={() => add(option)}>
                <MapPin size={14} />
                <span><strong>{lang === "EN" ? option.nameEn : option.nameTh}</strong><small>{lang === "EN" ? option.nameTh : option.nameEn}</small></span>
                <Plus size={14} />
              </button>
            ))}
            {canAddCustom ? (
              <button type="button" role="option" aria-selected="false" className="trip-destination-custom-option" onPointerDown={(event) => { event.preventDefault(); commitQuery(); }} onClick={commitQuery}>
                <Plus size={14} />
                <span><strong>เพิ่ม “{query.trim()}”</strong><small>บันทึกเป็นเมืองใหม่ในประเทศที่เลือก</small></span>
              </button>
            ) : !options.length ? <p>{t("ไม่พบเมืองในรายการ")}</p> : null}
          </div>
        )}
      </div>
      <small>{t("เลือกจากรายการ หรือพิมพ์ชื่อใหม่เพื่อผูกเมืองนั้นกับประเทศที่เลือก")}</small>
    </div>
  );
}

type TimelineDocument = {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  itinerary_id: string | null;
};

type PendingTimelineDocument = {
  id: string;
  title: string;
  file: File;
};

async function uploadTimelineDocument(tripId:string,itineraryId:string,item:PendingTimelineDocument){
  const file=await prepareDocumentFile(item.file);
  const payload=new FormData();
  payload.set("title",item.title);
  payload.set("file",file);
  payload.set("itineraryId",itineraryId);
  const response=await fetch(`/api/trips/${tripId}/documents`,{method:"POST",body:payload});
  const body=await response.json().catch(()=>({}));
  if(response.ok)return body as TimelineDocument;
  if(response.status!==400||body.error!=="กรุณาอัปโหลดผ่าน Client Upload")throw new Error(body.error||"อัปโหลดเอกสารไม่สำเร็จ");
  const extension=file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"bin";
  const pathname=`documents/${tripId}/doc-${crypto.randomUUID()}.${extension}`;
  const blob=await uploadPrivateDocument({tripId,pathname,file});
  const finalized=await fetch(`/api/trips/${tripId}/documents`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:item.title,originalFilename:file.name,mimeType:file.type,size:file.size,blobUrl:blob.url,pathname:blob.pathname,itineraryId})});
  const saved=await finalized.json().catch(()=>({}));
  if(!finalized.ok)throw new Error(saved.error||"อัปโหลดเอกสารไม่สำเร็จ");
  return saved as TimelineDocument;
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
  close: (reason?: "cancel" | "saved") => void;
  submit: (data: Record<string, unknown>) => Promise<unknown>;
  deleteItem: (item: Itinerary) => Promise<void>;
  deleteTrip: (trip: Trip) => Promise<void>;
  canDelete: boolean;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [summaryImageFile, setSummaryImageFile] = useState<File | null>(null);
  const [summaryImagePreview, setSummaryImagePreview] = useState(modal.type==="trip"?modal.trip?.summary_image_url||"":"");
  const [summaryImageRemoved, setSummaryImageRemoved] = useState(false);
  const [timelineImageFile, setTimelineImageFile] = useState<File | null>(null);
  const [timelineImageRemoved, setTimelineImageRemoved] = useState(false);
  const [selectedLocationImage, setSelectedLocationImage] = useState<
    string | null | undefined
  >(undefined);
  const [timelineDocuments, setTimelineDocuments] = useState<TimelineDocument[]>([]);
  const [pendingTimelineDocuments, setPendingTimelineDocuments] = useState<PendingTimelineDocument[]>([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(modal.type==="place"&&Boolean(modal.item));
  const [documentDeletingId, setDocumentDeletingId] = useState<string | null>(null);
  const [persistedNewPlaceId, setPersistedNewPlaceId] = useState<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const summaryImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [confirmDisableFlights, setConfirmDisableFlights] = useState(false);
  const [fileRemovalConfirmation,setFileRemovalConfirmation]=useState<Confirmation|null>(null);
  const [mediaPreview,setMediaPreview]=useState<{url:string;title:string;mimeType:string;temporary:boolean}|null>(null);
  const flightDisableConfirmed = useRef(false);
  const modalBackdropRef = useRef<HTMLDivElement>(null);
  const focusedTripFieldRef = useRef<HTMLElement | null>(null);
  const focusVisibilityTimerRef = useRef<number | null>(null);
  const canDeleteCurrent =
    modal.type === "trip" ? modal.trip?.access_role === "owner" : canDelete;
  const formDirtyKey =
    modal.type === "trip"
      ? `trip:${modal.trip?.id || "new"}`
      : `place:${modal.item?.id || "new"}`;
  const { formRef, hasChanges, checkForChanges } = useFormDirty(formDirtyKey);
  useEffect(()=>{
    if(modal.type!=="place"||!modal.item||!trip)return;
    let active=true;
    fetch(`/api/trips/${trip.id}/documents?itineraryId=${encodeURIComponent(modal.item.id)}`)
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"โหลดเอกสารไม่สำเร็จ");if(active)setTimelineDocuments(Array.isArray(body)?body:[])})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"โหลดเอกสารไม่สำเร็จ")})
      .finally(()=>{if(active)setDocumentsLoading(false)});
    return()=>{active=false};
  },[modal,trip]);
  useEffect(()=>()=>{if(summaryImagePreview.startsWith("blob:"))URL.revokeObjectURL(summaryImagePreview)},[summaryImagePreview]);
  const initialCountry =
    modal.type === "trip"
      ? countryByCode(modal.trip?.country_code) ||
        countryByCode(modal.preset?.countryCode) ||
        countryByCode(TRIP_DESTINATION_OPTIONS.find((option) => {
          const destination = (modal.preset?.destination || "").trim().toLowerCase();
          return [option.nameTh, option.nameEn, ...option.searchTerms].some((term) => term.trim().toLowerCase() === destination);
        })?.countryCode) ||
        inferTripCountry(modal.trip?.destination, modal.trip?.timezone)
      : TRIP_COUNTRIES[0];
  const [countryCode, setCountryCode] = useState(initialCountry.code);
  const [tripDestinations, setTripDestinations] = useState<TripDestinationOption[]>(() => {
    if (modal.type !== "trip") return [];
    if (!modal.trip && modal.preset) {
      if (modal.preset.tripDestinations?.length) {
        return modal.preset.tripDestinations;
      }
      if (modal.preset.locationIds?.length) {
        return modal.preset.locationIds.flatMap((id) => {
          const candidate = TRIP_DESTINATION_OPTIONS.find((option) => option.id === id);
          return candidate ? [candidate] : [];
        });
      }
      const destination = modal.preset.destination.trim().toLowerCase();
      const option = TRIP_DESTINATION_OPTIONS.find((candidate) =>
        [candidate.nameTh, candidate.nameEn, ...candidate.searchTerms].some((term) => term.trim().toLowerCase() === destination),
      );
      return option ? [option] : [];
    }
    const saved = modal.trip?.trip_destinations || [];
    const resolved = saved.flatMap((destination) => {
      const option = TRIP_DESTINATION_OPTIONS.find((candidate) => candidate.id === destination.id);
      return option ? [option] : destination.nameTh || destination.nameEn ? [{...destination,searchTerms:[destination.nameTh,destination.nameEn].filter(Boolean)} as TripDestinationOption] : [];
    });
    if (resolved.length) return resolved;
    const legacy = `${modal.trip?.destination || ""} ${modal.trip?.country_name || ""}`.toLowerCase();
    return TRIP_DESTINATION_OPTIONS.filter((option) =>
      option.countryCode === initialCountry.code &&
      [option.nameTh, option.nameEn, ...option.searchTerms].some((term) => {
        const normalized = term.trim().toLowerCase();
        return normalized.length >= 3 && legacy.includes(normalized);
      }),
    );
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("sheet-open");
    return () => root.classList.remove("sheet-open");
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const backdrop = modalBackdropRef.current;
    if (!viewport || !backdrop) return;
    const keepFocusedFieldVisible = () => {
      const modalElement = formRef.current;
      const focused = focusedTripFieldRef.current;
      if (!modalElement || !focused || !modalElement.contains(focused)) return;
      const scrollElement =
        modalElement.querySelector<HTMLElement>(".bottom-sheet-body") ||
        modalElement;
      const field = focused.closest<HTMLElement>(".field") || focused;
      const fieldRect = field.getBoundingClientRect();
      const modalRect = modalElement.getBoundingClientRect();
      const visibleTop = Math.max(modalRect.top + 18, viewport.offsetTop + 14);
      const visibleBottom = Math.min(
        modalRect.bottom - 86,
        viewport.offsetTop + viewport.height - 14,
      );
      if (fieldRect.top < visibleTop) {
        scrollElement.scrollTop = Math.max(
          0,
          scrollElement.scrollTop + fieldRect.top - visibleTop,
        );
      } else if (fieldRect.bottom > visibleBottom) {
        scrollElement.scrollTop += fieldRect.bottom - visibleBottom;
      }
    };
    const scheduleFocusedFieldVisibility = () => {
      requestAnimationFrame(keepFocusedFieldVisible);
      if (focusVisibilityTimerRef.current) {
        window.clearTimeout(focusVisibilityTimerRef.current);
      }
      focusVisibilityTimerRef.current = window.setTimeout(
        keepFocusedFieldVisible,
        380,
      );
    };
    const syncViewport = () => {
      const modalElement = formRef.current;
      const focused = focusedTripFieldRef.current;
      if (
        !modalElement ||
        !focused ||
        document.activeElement !== focused ||
        !modalElement.contains(focused)
      ) {
        backdrop.style.removeProperty("--modal-viewport-height");
        backdrop.style.removeProperty("--modal-viewport-top");
        return;
      }
      backdrop.style.setProperty("--modal-viewport-height", `${viewport.height}px`);
      backdrop.style.setProperty("--modal-viewport-top", `${viewport.offsetTop}px`);
      scheduleFocusedFieldVisibility();
    };
    const handleFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      focusedTripFieldRef.current = event.target;
      backdrop.classList.remove("sheet-keyboard-dismissed");
      syncViewport();
      scheduleFocusedFieldVisibility();
    };
    const handleBlur = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        const isEditing =
          active instanceof HTMLElement &&
          backdrop.contains(active) &&
          active.matches("input,textarea,select,[contenteditable='true']");
        if (isEditing) return;
        focusedTripFieldRef.current = null;
        backdrop.style.removeProperty("--modal-viewport-height");
        backdrop.style.removeProperty("--modal-viewport-top");
        backdrop.classList.add("sheet-keyboard-dismissed");
      }, 0);
    };
    syncViewport();
    backdrop.addEventListener("focusin", handleFocus);
    backdrop.addEventListener("focusout", handleBlur);
    viewport.addEventListener("resize", syncViewport, { passive: true });
    viewport.addEventListener("scroll", syncViewport, { passive: true });
    return () => {
      backdrop.removeEventListener("focusin", handleFocus);
      backdrop.removeEventListener("focusout", handleBlur);
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      if (focusVisibilityTimerRef.current) {
        window.clearTimeout(focusVisibilityTimerRef.current);
      }
    };
  }, [formRef]);
  const initialOutboundDate =
    modal.type === "trip"
      ? localDate(
          modal.trip?.outbound_departure_at,
          modal.trip?.start_date || modal.preset?.outboundDate || "",
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
      ? initialOutboundDate
      : savedReturnDate;
  const [outboundDate, setOutboundDate] = useState(initialOutboundDate);
  const [returnDate, setReturnDate] = useState(initialReturnDate);
  const placeSource = modal.type === "place" ? modal.item : undefined;
  const [placeName, setPlaceName] = useState(placeSource?.place_name || "");
  const initialPlaceDay =
    modal.type === "place"
      ? placeSource?.day_number || modal.defaultDay || day
      : day;
  const [placeDay, setPlaceDay] = useState(initialPlaceDay);
  const [placeStartTime, setPlaceStartTime] = useState(
    modal.type === "place"
      ? modal.item
        ? modal.item.start_time?.slice(0, 5) || "09:00"
        : modal.defaultTime || nextPlanTime(items, initialPlaceDay)
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
  function selectSummaryImage(file:File|null){
    if(summaryImagePreview.startsWith("blob:"))URL.revokeObjectURL(summaryImagePreview);
    setSummaryImageFile(file);
    setSummaryImageRemoved(false);
    setSummaryImagePreview(file?URL.createObjectURL(file):(modal.type==="trip"?modal.trip?.summary_image_url||"":""));
    checkForChanges();
  }
  function removeSummaryImage(){
    if(summaryImagePreview.startsWith("blob:"))URL.revokeObjectURL(summaryImagePreview);
    setSummaryImageFile(null);
    setSummaryImagePreview("");
    setSummaryImageRemoved(true);
    if(summaryImageInputRef.current)summaryImageInputRef.current.value="";
    checkForChanges();
  }
  function askRemoveSummaryImage(){
    setFileRemovalConfirmation({title:"ลบรูป Plan รวม?",description:"รูปจะถูกนำออกเมื่อกดบันทึกการแก้ไข",confirmLabel:"ลบรูป",onConfirm:removeSummaryImage});
  }
  function closeMediaPreview(){
    setMediaPreview(current=>{if(current?.temporary)URL.revokeObjectURL(current.url);return null});
  }
  function openStoredDocument(document:TimelineDocument){
    if(!trip)return;
    setMediaPreview({url:`/api/trips/${trip.id}/documents/${document.id}/file`,title:document.title,mimeType:document.mime_type,temporary:false});
  }
  function openPendingDocument(document:PendingTimelineDocument){
    setMediaPreview({url:URL.createObjectURL(document.file),title:document.title,mimeType:document.file.type,temporary:true});
  }
  function askRemovePendingDocument(document:PendingTimelineDocument){
    setFileRemovalConfirmation({title:`นำ “${document.title}” ออกจากลิสต์?`,description:"ไฟล์นี้จะไม่ถูกอัปโหลดเมื่อกดบันทึก",confirmLabel:"นำออก",onConfirm:()=>setPendingTimelineDocuments(current=>current.filter(item=>item.id!==document.id))});
  }
  function askRemoveExistingDocument(document:TimelineDocument){
    setFileRemovalConfirmation({title:`ลบ “${document.title}”?`,description:"ไฟล์นี้จะถูกลบออกจากรายการอย่างถาวร",confirmLabel:"ลบไฟล์",onConfirm:()=>removeExistingDocument(document.id)});
  }
  function addPendingDocument(){
    const title=documentTitle.trim();
    if(!title||!documentFile){setError("กรุณาตั้งชื่อและเลือกเอกสาร");return}
    setPendingTimelineDocuments(current=>[...current,{id:crypto.randomUUID(),title,file:documentFile}]);
    setDocumentTitle("");
    setDocumentFile(null);
    if(documentInputRef.current)documentInputRef.current.value="";
    setError("");
    checkForChanges();
  }
  async function removeExistingDocument(documentId:string){
    if(!trip)return;
    setDocumentDeletingId(documentId);
    try{
      const response=await fetch(`/api/trips/${trip.id}/documents/${documentId}`,{method:"DELETE"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"ลบเอกสารไม่สำเร็จ");
      setTimelineDocuments(current=>current.filter(document=>document.id!==documentId));
      invalidateClientResourcesContaining(`trip:${trip.id}:`);
    }catch(reason){setError(reason instanceof Error?reason.message:"ลบเอกสารไม่สำเร็จ")}
    finally{setDocumentDeletingId(null)}
  }
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
        if (!tripDestinations.length) throw new Error("กรุณาเลือกเมืองหรือจังหวัดอย่างน้อย 1 แห่ง");
        let coverImageUrl = modal.trip?.cover_image_url || modal.preset?.coverImageUrl || DEFAULT_TRIP_COVER;
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
          if (typeof result.url !== "string" || !result.url) {
            throw new Error("ไม่พบ URL ของรูปที่อัปโหลด");
          }
          coverImageUrl = result.url;
        }
        let summaryImageUrl=summaryImageRemoved?null:modal.trip?.summary_image_url||null;
        if(summaryImageFile){
          const upload=new FormData();upload.set("file",summaryImageFile);
          const response=await fetch("/api/uploads",{method:"POST",body:upload});
          const result=await response.json();
          if(!response.ok)throw new Error(result.error||"อัปโหลดรูป Plan ไม่สำเร็จ");
          summaryImageUrl=result.url;
        }
        await submit({
          name: f.get("name"),
          countryCode: f.get("countryCode"),
          locationIds: tripDestinations.map((destination) => destination.id),
          googlePhotosUrl: String(f.get("googlePhotosUrl") || "").trim(),
          outboundDate: f.get("outboundDate"),
          outboundTime: f.get("outboundTime"),
          returnDate: f.get("returnDate"),
          returnTime: f.get("returnTime"),
          budgetThb: amount(f, "budgetThb"),
          shoppingBudgetThb: amount(f, "shoppingBudgetThb"),
          hasFlights: f.get("hasFlights") === "true",
          coverImageUrl,
          summaryImageUrl,
        });
      }
      if (modal.type === "place") {
        let imageUrl=timelineImageRemoved?null:modal.item?.image_url||null;
        if(timelineImageFile){
          const upload=new FormData();upload.set("file",timelineImageFile);
          const response=await fetch("/api/uploads",{method:"POST",body:upload});
          const result=await response.json();
          if(!response.ok)throw new Error(result.error||"อัปโหลดรูปสถานที่ไม่สำเร็จ");
          if(typeof result.url!=="string"||!result.url)throw new Error("ไม่พบ URL ของรูปที่อัปโหลด");
          imageUrl=result.url;
        }
        const stagedTimelineDocuments=[...pendingTimelineDocuments];
        if(documentFile){
          const title=documentTitle.trim();
          if(!title)throw new Error("กรุณาตั้งชื่อเอกสาร");
          stagedTimelineDocuments.push({id:crypto.randomUUID(),title,file:documentFile});
        }
        const startTime = String(f.get("startTime"));
        const hour = Number(startTime.slice(0, 2));
        const timeSlot =
          hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        const saved=modal.item||!persistedNewPlaceId?await submit({
            placeName: f.get("placeName"),
            address: f.get("address"),
            transportMode: placeIsFirst
              ? undefined
              : f.get("transportMode"),
            transportNote: f.get("transportNote"),
            imageUrl,
            costItems: modal.item?.cost_items || [],
            dayNumber: Number(f.get("dayNumber")),
            timeSlot,
            startTime,
          }) as Itinerary:null;
        const itineraryId=saved?.id||persistedNewPlaceId||modal.item?.id;
        if(!modal.item&&saved?.id)setPersistedNewPlaceId(saved.id);
        if(trip&&itineraryId&&stagedTimelineDocuments.length){
          for(const document of stagedTimelineDocuments){
            await uploadTimelineDocument(trip.id,itineraryId,document);
            setPendingTimelineDocuments(current=>current.filter(item=>item.id!==document.id));
          }
          invalidateClientResourcesContaining(`trip:${trip.id}:`);
        }
      }
      close("saved");
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
    <>
      <BottomSheet
        title={title}
        subtitle={t(modal.type === "trip" ? "จัดการข้อมูลและรายละเอียดของทริป" : "จัดการรายละเอียดของรายการใน Timeline")}
        closeLabel={t("ยกเลิก")}
        onClose={() => close()}
        onSubmit={handle}
        formRef={formRef}
        onChange={checkForChanges}
        busy={saving}
        backdropClassName="trip-modal-backdrop"
        backdropRef={modalBackdropRef}
        submitLabel={t(saving ? "กำลังบันทึก…" : "บันทึก")}
        submitDisabled={saving || (!hasChanges && !coverFile && !summaryImageFile && !summaryImageRemoved && !timelineImageFile && !timelineImageRemoved && !documentFile && pendingTimelineDocuments.length===0)}
        onDelete={canDeleteCurrent && ((modal.type === "place" && modal.item) || (modal.type === "trip" && modal.trip)) ? () => setPendingDelete(true) : undefined}
        deleteDisabled={saving}
        deleteLabel={t(modal.type === "trip" ? "ลบทริป" : "ลบรายการ")}
      >
        <div className="form-grid">
          {modal.type === "trip" && (
            <>
              <CoverImagePicker
                existingUrl={modal.trip?.cover_image_url || modal.preset?.coverImageUrl}
                onChange={(file) => {
                  setCoverFile(file);
                  checkForChanges();
                }}
              />
              <div className="field">
                <label>{t("ชื่อทริป")}</label>
                <input name="name" required defaultValue={modal.trip?.name || modal.preset?.destination} />
              </div>
              <CountryPicker
                value={countryCode}
                onChange={(nextCountryCode) => {
                  setCountryCode(nextCountryCode);
                  setTripDestinations([]);
                  window.setTimeout(checkForChanges, 0);
                }}
                note={<>{t("เลือกประเทศก่อน แล้วจึงค้นหาเมืองด้านล่าง")} · {t("เวลาอัตโนมัติ")}: {countryByCode(countryCode)?.timezone}</>}
              />
              <TripDestinationPicker
                countryCode={countryCode}
                selected={tripDestinations}
                onChange={(next) => {
                  setTripDestinations(next);
                  window.setTimeout(checkForChanges, 0);
                }}
              />
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
                      setReturnDate(value);
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
                    defaultValue={localTime(modal.trip?.outbound_departure_at, modal.preset?.outboundTime || "")}
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
              <section className="trip-plan-image-editor">
                <div className="trip-plan-image-head">
                  <div><strong>{t("รูป Plan รวม")}</strong><small>{t("ไม่บังคับ · เพิ่มได้หนึ่งรูป และเปลี่ยนหรือลบได้ภายหลัง")}</small></div>
                  {summaryImagePreview&&<button type="button" onClick={askRemoveSummaryImage} aria-label={t("ลบรูป Plan")}><Trash2 size={16}/></button>}
                </div>
                {summaryImagePreview&&<button type="button" className="trip-plan-image-preview" aria-label={t("เปิดรูป Plan เต็มจอ")} onClick={()=>setMediaPreview({url:summaryImagePreview,title:t("รูป Plan รวม"),mimeType:summaryImageFile?.type||"image/jpeg",temporary:false})} style={{backgroundImage:`url("${summaryImagePreview}")`}}/>}
                <DocumentFilePicker fileName={summaryImageFile?.name||""} inputRef={summaryImageInputRef} onFileChange={selectSummaryImage} accept="image/jpeg,image/png,image/webp" idleLabel={summaryImagePreview?t("เลือกรูปใหม่เพื่อแทนที่"):t("เลือกรูป Plan")} idleNote={t("รองรับ JPG, PNG และ WebP · เพิ่มได้หนึ่งรูป")} selectedNote={t("พร้อมอัปโหลดเมื่อกดบันทึก")}/>
              </section>
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
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </div>
              <TripLocationInput
                key={`${modal.item ? "edit" : "new"}-${placeSource?.id || "location"}`}
                items={items}
                currentItem={placeSource}
                onSelectPlace={(item) => {
                  const normalizedAddress = item.address
                    ?.trim()
                    .toLocaleLowerCase()
                    .replace(/\s+/g, " ");
                  const imageSource = [item, ...items].find(
                    (candidate) =>
                      candidate.id !== placeSource?.id &&
                      candidate.address
                        ?.trim()
                        .toLocaleLowerCase()
                        .replace(/\s+/g, " ") === normalizedAddress &&
                      Boolean(
                        candidate.image_url ||
                          candidate.location_image_url ||
                          candidate.accommodation_image_url,
                      ),
                  );
                  setPlaceName(item.place_name.trim());
                  setSelectedLocationImage(
                    imageSource?.image_url ||
                      imageSource?.location_image_url ||
                      imageSource?.accommodation_image_url ||
                      null,
                  );
                  requestAnimationFrame(checkForChanges);
                }}
                onAddressChange={() => setSelectedLocationImage(undefined)}
              />
              {selectedLocationImage !== undefined && (
                <p
                  className={`timeline-location-image-status ${
                    selectedLocationImage ? "has-image" : "uses-default"
                  }`}
                  role="status"
                >
                  {selectedLocationImage ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <ImagePlus size={15} />
                  )}
                  <span>
                    {t(
                      selectedLocationImage
                        ? "พบรูปของโลเคชันนี้แล้ว ระบบจะนำมาใช้ให้อัตโนมัติ"
                        : "โลเคชันนี้ยังไม่มีรูป ระบบจะใช้รูปเริ่มต้น",
                    )}
                  </span>
                </p>
              )}
              <CoverImagePicker
                key={`timeline-image-${placeSource?.id || "new"}`}
                existingUrl={placeSource?.image_url}
                variant="square"
                removable
                onChange={(file)=>{
                  setTimelineImageFile(file);
                  setTimelineImageRemoved(file === null);
                  checkForChanges();
                }}
              />
              {!placeIsFirst && (
                <div className="field">
                  <label>{t("วิธีเดินทางมาที่นี่")}</label>
                  <select
                    name="transportMode"
                    defaultValue={
                      placeSource?.transport_mode ||
                      (modal.defaultTime && trip?.country_code === "TH"
                        ? "รถยนต์"
                        : "")
                    }
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
              <section className="timeline-document-editor">
                <div className="timeline-document-heading"><div><strong>{t("เอกสารแนบ")}</strong><small>{t("เพิ่มรูปหรือ PDF พร้อมตั้งชื่อไฟล์")}</small></div></div>
                {documentsLoading?<p className="timeline-document-loading">{t("กำลังโหลดเอกสาร…")}</p>:null}
                {(timelineDocuments.length>0||pendingTimelineDocuments.length>0)&&<div className="timeline-document-list">
                  {timelineDocuments.map(document=><div className="timeline-document-row" key={document.id}><FileText size={17}/><button type="button" className="timeline-document-open" onClick={()=>openStoredDocument(document)}><strong>{document.title}</strong><small>{document.original_filename}</small></button>{canDeleteCurrent?<button type="button" disabled={documentDeletingId===document.id} onClick={()=>askRemoveExistingDocument(document)} aria-label={t("ลบเอกสาร")}><Trash2 size={15}/></button>:null}</div>)}
                  {pendingTimelineDocuments.map(document=><div className="timeline-document-row is-pending" key={document.id}><FileText size={17}/><button type="button" className="timeline-document-open" onClick={()=>openPendingDocument(document)}><strong>{document.title}</strong><small>{document.file.name} · {t("พร้อมอัปโหลดเมื่อกดบันทึก")}</small></button><button type="button" onClick={()=>askRemovePendingDocument(document)} aria-label={t("นำออกจากลิสต์")}><Trash2 size={15}/></button></div>)}
                </div>}
                <div className="field"><label>{t("ชื่อไฟล์")}</label><input value={documentTitle} onChange={event=>setDocumentTitle(event.target.value)} maxLength={180} placeholder={t("เช่น ใบจองโรงแรม")}/></div>
                <DocumentFilePicker fileName={documentFile?.name||""} inputRef={documentInputRef} onFileChange={file=>{setDocumentFile(file);if(file&&!documentTitle.trim())setDocumentTitle(file.name.replace(/\.[^.]+$/,"").slice(0,180))}} selectedNote={t("พร้อมอัปโหลดเมื่อกดบันทึก")}/>
                <button className="secondary-btn timeline-document-add" type="button" onClick={addPendingDocument} disabled={!documentFile||!documentTitle.trim()}><Plus size={16}/>{t("เพิ่มในลิสต์")}</button>
              </section>
            </>
          )}
        </div>
        {error && <p className="login-error">{t(error)}</p>}
      </BottomSheet>
      {canDeleteCurrent && pendingDelete && modal.type === "place" && modal.item && (
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
      {canDeleteCurrent && pendingDelete && modal.type === "trip" && modal.trip && (
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
      {fileRemovalConfirmation&&<ConfirmDialog confirmation={fileRemovalConfirmation} close={()=>setFileRemovalConfirmation(null)}/>}
      {mediaPreview&&<div className="attachment-preview-overlay" role="dialog" aria-modal="true" aria-label={mediaPreview.title} onMouseDown={event=>{if(event.target===event.currentTarget)closeMediaPreview()}}>
        <header><strong>{mediaPreview.title}</strong><button type="button" onClick={closeMediaPreview} aria-label={t("ปิดรูปเต็มจอ")}><X size={20}/></button></header>
        <div className="attachment-preview-content">{mediaPreview.mimeType.startsWith("image/")?<Image src={mediaPreview.url} alt={mediaPreview.title} fill sizes="100vw" unoptimized/>:<iframe src={mediaPreview.url} title={mediaPreview.title}/>}</div>
      </div>}
    </>
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
  initialAlbumTrips,
  initialTrip,
  initialItineraries,
  initialTripCards,
  initialTripFilters = {
    status: "",
    type: "",
    year: "",
    q: "",
    sort: "",
    focus: "",
    loaded: "",
  },
  initialTripDirectory,
  initialTripPreset,
}: {
  authenticated?: boolean;
  demo?: boolean;
  storageAdmin?: boolean;
  page?: Screen;
  tripId?: string;
  returnTo?: string;
  authError?: string;
  workspaceTab?: WorkspaceTab;
  tripView?: "flights" | "insurance" | "stays";
  accommodationId?: string;
  initialDashboard?: {
    ongoing: Trip[];
    upcoming: Trip[];
    past: Trip[];
    favoriteAccommodations: FavoriteAccommodation[];
    counts: DashboardCounts;
    countryHighlights: CountryHighlight[];
  };
  initialAnalytics?: TravelAnalyticsCollection;
  initialAlbumTrips?: Trip[];
  initialTrip?: Trip | null;
  initialItineraries?: Itinerary[];
  initialTripCards?: PaymentCard[];
  initialTripFilters?: TripFilters;
  initialTripDirectory?: { items: Trip[]; total: number; years: number[]; hasMore: boolean; statusCounts?: Record<TripStatus,number> };
  initialTripPreset?: TripCreationPreset | null;
}) {
  const initialDashboardTrips = initialDashboard
    ? applyCachedTripReviewSummaries([
        ...initialDashboard.ongoing,
        ...initialDashboard.upcoming,
        ...initialDashboard.past,
      ])
    : null;
  const cachedDashboardSnapshot =
    page === "dashboard" ? dashboardSnapshotCache : null;
  // Client-side navigation can reuse an older RSC payload for a trip route.
  // Prefer the client snapshot because it is updated immediately after edits;
  // a hard reload still starts from `initialTrip` because the module cache is
  // empty in that case.
  const initialSelected = tripId
    ? tripListCache?.find((trip) => trip.id === tripId) || initialTrip || null
    : null;
  const cachedSelected = initialSelected
    ? applyCachedTripReviewSummary(initialSelected)
    : null;
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const lang: Lang = "TH";
  const [headerProfile, setHeaderProfile] = useState<AccountProfile | null>(null);
  const [trips, setTrips] = useState<Trip[]>(() =>
    cachedDashboardSnapshot?.trips ||
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
  const [modal, setModal] = useState<Modal>(() =>
    page === "dashboard" && initialTripPreset && !demo
      ? { type: "trip", preset: initialTripPreset }
      : null,
  );
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(
    (page === "dashboard" && !initialDashboard) ||
      (["trip", "timeline", "expenses"].includes(page) && !cachedSelected),
  );
  const [activeDay, setActiveDay] = useState(1);
  const [dashboardCounts, setDashboardCounts] = useState<DashboardCounts>(
    cachedDashboardSnapshot?.counts ||
      initialDashboard?.counts || { total: 0, ongoing: 0, upcoming: 0, past: 0 },
  );
  const [dashboardCountryHighlights, setDashboardCountryHighlights] = useState<
    CountryHighlight[]
  >(
    cachedDashboardSnapshot?.countryHighlights ||
      initialDashboard?.countryHighlights ||
      [],
  );
  const [dashboardFavoriteAccommodations, setDashboardFavoriteAccommodations] = useState<FavoriteAccommodation[]>(
    initialDashboard?.favoriteAccommodations ||
      cachedDashboardSnapshot?.favoriteAccommodations ||
      [],
  );
  const [tripRevision, setTripRevision] = useState(0);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [tripDirectoryRefreshToken, setTripDirectoryRefreshToken] = useState(0);
  const [refreshingTripDirectory, setRefreshingTripDirectory] = useState(false);
  const tripDirectoryRefreshRequestedRef = useRef(false);
  const finishTripDirectoryRefresh = useCallback(
    () => {
      setRefreshingTripDirectory(false);
      if (!tripDirectoryRefreshRequestedRef.current) return;
      tripDirectoryRefreshRequestedRef.current = false;
      setToast("อัปเดตหน้ารวมทริปแล้ว");
      window.setTimeout(() => setToast(""), 1800);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    getCurrentAccount()
      .then((profile) => {
        if (active) setHeaderProfile(profile);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [dashboardRefreshToken]);
  useEffect(() => {
    if (initialDashboard) {
      setDashboardFavoriteAccommodations(
        initialDashboard.favoriteAccommodations || [],
      );
      if (dashboardSnapshotCache) {
        dashboardSnapshotCache = {
          ...dashboardSnapshotCache,
          favoriteAccommodations:
            initialDashboard.favoriteAccommodations || [],
        };
      }
    }
    if (initialDashboard && !dashboardSnapshotCache) {
      const initialTrips = applyCachedTripReviewSummaries([
        ...initialDashboard.ongoing,
        ...initialDashboard.upcoming,
        ...initialDashboard.past,
      ]);
      tripListCache = initialTrips;
      dashboardSnapshotCache = {
        trips: initialTrips,
        favoriteAccommodations: initialDashboard.favoriteAccommodations || [],
        counts: initialDashboard.counts,
        countryHighlights: initialDashboard.countryHighlights,
      };
    }
    if (tripId && initialTrip) {
      const nextInitialTrip =
        tripListCache?.find((trip) => trip.id === tripId) ||
        applyCachedTripReviewSummary(initialTrip);
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
    activeLang = "TH";
    document.documentElement.lang = "th";
    localStorage.removeItem("bn-lang");
  }, []);
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
    if (page === "dashboard" && initialDashboard) return;
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
          setDashboardFavoriteAccommodations(data.favoriteAccommodations || []);
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
  async function refreshDashboard({
    announce = true,
  }: { announce?: boolean } = {}) {
    if (refreshingDashboard) return;
    setRefreshingDashboard(true);
    if (announce) clearCurrentAccount();
    try {
      const snapshot = await fetchFreshDashboardSnapshot();
      startTransition(() => {
        setTrips(snapshot.trips);
        setDashboardCounts(snapshot.counts);
        setDashboardCountryHighlights(snapshot.countryHighlights);
        setDashboardFavoriteAccommodations(snapshot.favoriteAccommodations);
        setDashboardRefreshToken((value) => value + 1);
      });
      if (announce) {
        setToast("อัปเดตหน้าแรกแล้ว");
        window.setTimeout(() => setToast(""), 1800);
      }
    } catch {
      if (announce) {
        setToast("รีเฟรชไม่สำเร็จ กรุณาลองอีกครั้ง");
        window.setTimeout(() => setToast(""), 2400);
      }
    } finally {
      setRefreshingDashboard(false);
    }
  }
  useEffect(() => {
    if (page !== "dashboard") return;
    if (sessionStorage.getItem("bn-trip-favorites-changed") !== "1") return;
    sessionStorage.removeItem("bn-trip-favorites-changed");
    void refreshDashboard({ announce: false });
  }, [page]);
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
  const fetchFreshItineraries = async (id: string) => {
    const data = await request(`/api/trips/${id}/itineraries`, {
      cache: "no-store",
    });
    return Array.isArray(data) ? (data as Itinerary[]) : [];
  };
  async function saveModal(data: Record<string, unknown>) {
    if (!modal) return;
    if (modal.type === "trip") {
      const response = await request(
        modal.trip ? `/api/trips/${modal.trip.id}` : "/api/trips",
        {
          method: modal.trip ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            !modal.trip && modal.preset?.sourceIdeaId
              ? { ...data, sourceIdeaId: modal.preset.sourceIdeaId }
              : data,
          ),
        },
      );
      // Use the URL returned by the upload immediately. Apart from making the
      // UI deterministic, this prevents a stale API snapshot from restoring
      // the previous cover while the edit sheet is closing.
      const requestedCoverImageUrl =
        typeof data.coverImageUrl === "string" && data.coverImageUrl
          ? data.coverImageUrl
          : response.cover_image_url;
      const saved: Trip = {
        ...response,
        cover_image_url: requestedCoverImageUrl,
        members: response.members ?? modal.trip?.members ?? [],
      };
      const cachedTrips = tripListCache || trips;
      tripListCache = modal.trip
        ? cachedTrips.map((trip) => (trip.id === saved.id ? saved : trip))
        : [saved, ...cachedTrips.filter((trip) => trip.id !== saved.id)];
      if (dashboardSnapshotCache) {
        dashboardSnapshotCache = {
          ...dashboardSnapshotCache,
          trips: modal.trip
            ? dashboardSnapshotCache.trips.map((trip) =>
                trip.id === saved.id ? saved : trip,
              )
            : [
                saved,
                ...dashboardSnapshotCache.trips.filter(
                  (trip) => trip.id !== saved.id,
                ),
              ],
        };
      }
      setTrips((old) => {
        const next: Trip[] = modal.trip
          ? old.map((t) => (t.id === saved.id ? saved : t))
          : [saved, ...old];
        return next;
      });
      setTripRevision((value) => value + 1);
      if (!modal.trip) itineraryCache.set(saved.id, []);
      if (modal.trip && data.hasFlights === false) {
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
      if (!modal.trip && page === "dashboard") {
        await refreshDashboard({ announce: false });
      }
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
      return saved;
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
      const refreshed = await fetchFreshItineraries(selected.id).catch(
        () => null,
      );
      setItineraries((old) => {
        const next: Itinerary[] = refreshed ||
          (editing
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
          : "เพิ่มแผนเที่ยวและเรียง Timeline แล้ว",
      );
      return saved;
    }
  }
  async function removeItinerary(item: Itinerary) {
    await request(`/api/itineraries/${item.id}`, { method: "DELETE" });
    const refreshed = selected
      ? await fetchFreshItineraries(selected.id).catch(() => null)
      : null;
    setItineraries((old) => {
      const next = withoutFirstTransport(
        refreshed || old.filter((row) => row.id !== item.id),
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
    await refreshDashboard({ announce: false });
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
    dashboardSnapshotCache = null;
    tripInvitationsCache = null;
    nearbyFlightsCache = null;
    itineraryCache.clear();
    location.href = "/";
  };
  const openCost = (
    item?: Itinerary,
    index?: number,
    defaultDay?: number,
    returnToExpenseList?: () => void,
  ) => setModal({
    type: "cost",
    item,
    costIndex: index,
    defaultDay,
    returnToExpenseList,
  });
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
      favoriteAccommodations={dashboardFavoriteAccommodations}
      counts={dashboardCounts}
      countryHighlights={dashboardCountryHighlights}
      revision={tripRevision + dashboardRefreshToken}
      selectTrip={selectTrip}
      manageCollaborators={protect((trip) =>
        setModal({ type: "collaborators", trip }),
      )}
      openFlightTrip={(id) => router.push(`/trips/${id}?view=flights`)}
      createTrip={protect(() => setModal({ type: "trip" }))}
      viewAll={(status) =>
        router.push(status === "all" ? "/trips" : `/trips?status=${status}`)
      }
      viewAnalytics={() => router.push("/analytics")}
      viewBadges={() => router.push("/badges")}
      viewTripIdeas={() => router.push("/trip-ideas")}
      notify={flash}
    />
  ) : page === "analytics" && initialAnalytics ? (
    <TravelAnalyticsDashboard datasets={initialAnalytics} />
  ) : page === "album" ? (
    <TripsDirectory
      initialFilters={{
        status: "past",
        type: "",
        year: "",
        q: "",
        sort: "latest",
        focus: "",
        loaded: "",
      }}
      initialData={{
        items: initialAlbumTrips || [],
        total: initialAlbumTrips?.length || 0,
        years: [
          ...new Set(
            (initialAlbumTrips || []).map((trip) =>
              Number(trip.start_date.slice(0, 4)),
            ),
          ),
        ].filter(Boolean).sort((a, b) => b - a),
        hasMore: false,
      }}
      revision={tripRevision}
      selectTrip={selectTrip}
      manageCollaborators={protect((trip) =>
        setModal({ type: "collaborators", trip }),
      )}
      createTrip={protect(() => setModal({ type: "trip" }))}
    />
  ) : page === "trips" ? (
    <TripsDirectory
      initialFilters={initialTripFilters}
      initialData={initialTripDirectory}
      revision={tripRevision + tripDirectoryRefreshToken}
      selectTrip={selectTrip}
      manageCollaborators={protect((trip) =>
        setModal({ type: "collaborators", trip }),
      )}
      createTrip={protect(() => setModal({ type: "trip" }))}
      onRefreshComplete={finishTripDirectoryRefresh}
    />
  ) : page === "trip" && selected ? (
    <TripHub
      trip={selected}
      items={itineraries}
      cards={tripCards}
      day={activeDay}
      setDay={setActiveDay}
      openReviews={() => setModal({ type: "reviews", trip: selected })}
      manageCollaborators={protect(() =>
        setModal({ type: "collaborators", trip: selected }),
      )}
      leaveTrip={protect(() =>
        setModal({ type: "collaborators", trip: selected }),
      )}
      editTrip={protect(() => setModal({ type: "trip", trip: selected }))}
      addPlace={protect((day, defaultTime?: string) => {
        setActiveDay(day);
        setModal({ type: "place", defaultDay: day, defaultTime });
      })}
      editPlace={protect((item) => {
        setActiveDay(item.day_number);
        setModal({ type: "place", item });
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
      addPlace={protect((day, defaultTime?: string) => {
        setActiveDay(day);
        setModal({ type: "place", defaultDay: day, defaultTime });
      })}
      editTrip={protect(() => setModal({ type: "trip", trip: selected }))}
      notify={flash}
      onChanged={() => refreshActiveTrip(selected.id)}
    />
  ) : page === "expenses" && selected ? (
    <ExpensesScreen
      trip={selected}
      items={itineraries}
      cards={tripCards}
      openCost={protect(openCost)}
      editTrip={protect(() => setModal({ type: "trip", trip: selected }))}
    />
  ) : page === "settings" ? (
    <SettingsScreen
      dark={dark}
      toggleTheme={toggleTheme}
      lang={lang}
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
      onChanged={() =>
        void refreshTripMembers(modal.trip.id).then(() =>
          setTripRevision((value) => value + 1),
        )
      }
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
        close={() => {
          const returnToExpenseList = modal.returnToExpenseList;
          setModal(null);
          if (returnToExpenseList) {
            window.requestAnimationFrame(returnToExpenseList);
          }
        }}
        saveCost={saveCost}
        deleteCost={deleteCost}
        canDelete={selected.access_role !== "view"}
        notify={flash}
        onChanged={() => refreshActiveTrip(selected.id)}
      />
    ) : null
  ) : (
    <ModalForm
      modal={modal}
      trip={selected}
      day={activeDay}
      items={itineraries}
      close={(reason) => {
        const returnToIdeas = reason !== "saved" && modal.type === "trip" && !modal.trip && Boolean(modal.preset?.sourceIdeaId);
        setModal(null);
        if (returnToIdeas) router.push("/trip-ideas");
      }}
      submit={saveModal}
      deleteItem={removeItinerary}
      deleteTrip={removeTrip}
      canDelete={selected?.access_role !== "view"}
    />
  );
  const label = (value: string) => value;
  const mainNavigationPage = page === "dashboard" || page === "trips" || page === "settings";
  const tripNavigationPage =
    Boolean(selected) && ["trip", "timeline", "expenses"].includes(page);
  const refreshingMainPage =
    page === "dashboard"
      ? refreshingDashboard
      : page === "trips"
        ? refreshingTripDirectory
        : false;
  return (
    <LanguageContext.Provider value={lang}>
      <div
        className={`app-shell flow-shell ${page === "dashboard" ? "dashboard-page-shell" : ""} ${mainNavigationPage ? "main-nav-page-shell" : ""} ${page === "trip" || page === "expenses" ? "trip-page-shell" : ""} ${page === "timeline" ? "timeline-page-shell" : ""} ${demo ? "demo-mode" : ""}`}
      >
        {toast && (
          <div className="toast toast-success" role="status">
            <CheckCircle2 size={17} />
            {toast}
          </div>
        )}
        <main>
          {!tripNavigationPage && (
            <header className="mobile-head flow-header">
              <>
                <Brand />
                <nav
                  className="mobile-actions"
                  aria-label="เมนูหลัก"
                >
                  {!mainNavigationPage && (
                    <button className="icon-btn" onClick={() => router.push("/")} aria-label="หน้าแรก" title="หน้าแรก">
                      <House size={18} />
                    </button>
                  )}
                  {mainNavigationPage && (
                    <>
                      <button className="icon-btn home-refresh-btn" type="button" onClick={() => {
                        if (page === "dashboard") void refreshDashboard();
                        else if (page === "trips") {
                          if (refreshingTripDirectory) return;
                          tripDirectoryRefreshRequestedRef.current = true;
                          setRefreshingTripDirectory(true);
                          setTripDirectoryRefreshToken((value) => value + 1);
                        } else router.refresh();
                      }} disabled={refreshingMainPage} aria-label={label(refreshingMainPage ? "กำลังอัปเดต…" : "รีเฟรช")} title={label(refreshingMainPage ? "กำลังอัปเดต…" : "รีเฟรช")}>
                        <RefreshCw className={refreshingMainPage ? "analytics-refresh-spinning" : ""} size={24} />
                      </button>
                      <InvitationNotifications onChanged={async()=>{
                        tripListCache=null;
                        dashboardSnapshotCache=null;
                        setTripRevision(value=>value+1);
                        await refreshDashboard({announce:false});
                      }}/>
                      <button className="home-profile-btn" type="button" onClick={() => router.push("/settings")} aria-label="โปรไฟล์" title="โปรไฟล์">
                        <AccountAvatar profile={headerProfile} size="small" />
                      </button>
                    </>
                  )}
                  {!mainNavigationPage && (
                    <button className="icon-btn" onClick={() => router.push("/settings")} aria-label="ตั้งค่า" title="ตั้งค่า">
                      <Settings2 size={18} />
                    </button>
                  )}
                </nav>
              </>
            </header>
          )}
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
          <div className="route-content">
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
