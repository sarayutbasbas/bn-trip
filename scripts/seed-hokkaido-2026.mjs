import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const CARD_X = "Card x test · x-4233";
const KRUNGSRI_JCB = "Krungsri JCB · x-2222";
const CASH = "เงินสด";
const YOU_TRIP = "YouTrip";

function cost(key, { jpy, thb, category, paymentMethod, date }) {
  const foreignAmount = jpy ?? thb;
  return {
    id: randomUUID(),
    key,
    value: thb,
    category,
    currency: jpy === undefined ? "THB" : "JPY",
    foreignAmount,
    exchangeRate: jpy === undefined ? 1 : Number((thb / jpy).toFixed(6)),
    rateDate: date,
    paymentMethod,
  };
}

const plannedCosts = [
  cost("ตั๋วเครื่องบิน ไป-กลับ TG 2 คน", { thb: 58713, category: "ค่าตั๋วเครื่องบิน", paymentMethod: CARD_X, date: "2026-02-06" }),
  cost("Vessel Hotel Campana Susukino 7/2 (ยังไม่จ่าย Agoda)", { jpy: 31018, thb: 7251, category: "ที่พัก", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("Hotel Wing Asahikawa Ekimae 8/2", { thb: 4188, category: "ที่พัก", paymentMethod: CARD_X, date: "2026-02-08" }),
  cost("La Vista Furano Hills Hot Springs 9/2", { thb: 6096, category: "ที่พัก", paymentMethod: CARD_X, date: "2026-02-09" }),
  cost("Jozankei View Hotel 10-12/2 (2 คืน)", { thb: 9505, category: "ที่พัก", paymentMethod: CARD_X, date: "2026-02-10" }),
  cost("Vessel Hotel Campana Susukino 12-15/2 (3 คืน)", { thb: 14826, category: "ที่พัก", paymentMethod: CARD_X, date: "2026-02-12" }),
  cost("ค่าเช่ารถ", { thb: 10672, category: "เดินทาง", paymentMethod: CARD_X, date: "2026-02-08" }),
  cost("ประกันเดินทาง MSIG", { thb: 384, category: "อื่น ๆ", paymentMethod: CARD_X, date: "2026-02-06" }),
  cost("แลกเงินสด", { thb: 10150, category: "อื่น ๆ", paymentMethod: CASH, date: "2026-02-06" }),
  cost("แลกเงินใน YouTrip", { thb: 18345, category: "อื่น ๆ", paymentMethod: YOU_TRIP, date: "2026-02-06" }),
  cost("ใบขับขี่สากล", { thb: 565, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-06" }),
  cost("ซิม", { thb: 910, category: "อื่น ๆ", paymentMethod: CARD_X, date: "2026-02-06" }),
];

const day2BusCosts = [
  cost("ค่ารถบัสสนามบินไป S20 บาส", { jpy: 1300, thb: 271, category: "เดินทาง", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("ค่ารถบัสสนามบินไป S20 นา", { jpy: 1300, thb: 271, category: "เดินทาง", paymentMethod: KRUNGSRI_JCB, date: "2026-02-07" }),
];
const day2OdoriCosts = [
  cost("ค่าอาหาร อูนิ วากิว อิคูระ", { jpy: 8360, thb: 1741, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("ร้านยา Tax Free", { jpy: 8642, thb: 1800, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("ไคโระ", { jpy: 385, thb: 80, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("Ice cream", { jpy: 1200, thb: 250, category: "อาหาร", paymentMethod: CASH, date: "2026-02-07" }),
];
const day2SusukinoCosts = [
  cost("GU นา", { jpy: 8182, thb: 1704, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-07" }),
  cost("Uniqlo", { jpy: 13255, thb: 2761, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("Izakaya", { jpy: 8338, thb: 1737, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("Lawson 1", { jpy: 2162, thb: 450, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-07" }),
  cost("Lawson 2", { jpy: 540, thb: 112, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-07" }),
];

const day3DriveCosts = [cost("ETC ทางด่วน", { jpy: 2490, thb: 519, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-08" })];
const day3ZooCosts = [
  cost("ค่าตั๋วสวนสัตว์", { jpy: 2000, thb: 417, category: "กิจกรรม", paymentMethod: CARD_X, date: "2026-02-08" }),
  cost("น้ำเปล่า", { jpy: 130, thb: 27, category: "อาหาร", paymentMethod: CASH, date: "2026-02-08" }),
  cost("ข้าวโพดกระป๋อง", { jpy: 160, thb: 33, category: "อาหาร", paymentMethod: CASH, date: "2026-02-08" }),
  cost("คุกกี้", { jpy: 200, thb: 42, category: "อาหาร", paymentMethod: CASH, date: "2026-02-08" }),
];
const day3ShoppingCosts = [
  cost("GU", { jpy: 6246, thb: 1301, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-08" }),
  cost("ถุงร้อน", { jpy: 239, thb: 50, category: "อื่น ๆ", paymentMethod: CARD_X, date: "2026-02-08" }),
];
const day3DinnerCosts = [
  cost("Royce", { jpy: 3465, thb: 722, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-08" }),
  cost("ที่จอดรถ", { jpy: 1000, thb: 208, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-08" }),
  cost("ร้านวากิว", { jpy: 12265, thb: 2555, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-08" }),
];
const day3AeonCosts = [
  cost("กาชาปอง", { jpy: 400, thb: 83, category: "อื่น ๆ", paymentMethod: CASH, date: "2026-02-08" }),
  cost("ร้าน 7-11", { jpy: 538, thb: 112, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-08" }),
];

const day4MorningCosts = [cost("ข้าวแกงกะหรี่", { jpy: 2700, thb: 562, category: "อาหาร", paymentMethod: CASH, date: "2026-02-09" })];
const day4KanKanCosts = [cost("ค่าเข้า Kan Kan Mura", { jpy: 600, thb: 125, category: "กิจกรรม", paymentMethod: CASH, date: "2026-02-09" })];
const day4NingleCosts = [cost("Ice cream Ningle Terrace", { jpy: 900, thb: 187, category: "อาหาร", paymentMethod: CASH, date: "2026-02-09" })];

const day5CheeseCosts = [cost("Cheese Factory", { jpy: 1100, thb: 229, category: "อาหาร", paymentMethod: CASH, date: "2026-02-10" })];
const day5DriveCosts = [
  cost("ETC to Sapporo", { jpy: 2350, thb: 490, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-10" }),
  cost("เติมน้ำมัน", { jpy: 3776, thb: 787, category: "เดินทาง", paymentMethod: CARD_X, date: "2026-02-10" }),
  cost("Royce Bar", { jpy: 873, thb: 182, category: "อาหาร", paymentMethod: CASH, date: "2026-02-10" }),
];

const day6OnsenCosts = [cost("ค่าเข้าออนเซ็น", { jpy: 4040, thb: 842, category: "กิจกรรม", paymentMethod: CASH, date: "2026-02-11" })];
const day6FoodCosts = [
  cost("บาสซื้อน้ำเปล่า", { jpy: 140, thb: 29, category: "อาหาร", paymentMethod: CASH, date: "2026-02-11" }),
  cost("อาหารอินเดีย", { jpy: 2500, thb: 521, category: "อาหาร", paymentMethod: CASH, date: "2026-02-11" }),
  cost("ไอติม Jozankei", { jpy: 700, thb: 146, category: "อาหาร", paymentMethod: CASH, date: "2026-02-11" }),
];

const day7ReturnCarCosts = [cost("ETC", { jpy: 3346, thb: 697, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-12" })];
const day7ChocolateCosts = [
  cost("ขนมโรงงานช็อกโกแลต", { jpy: 1750, thb: 365, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-12" }),
  cost("รถเมล์ไป", { jpy: 480, thb: 100, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-12" }),
  cost("รถเมล์กลับ", { jpy: 1000, thb: 208, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-12" }),
  cost("รถไฟฟ้าไป", { jpy: 580, thb: 121, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-12" }),
  cost("รถไฟฟ้ากลับ Odori", { jpy: 580, thb: 121, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-12" }),
];
const day7BookOffCosts = [
  cost("Book Off บาส", { jpy: 19930, thb: 4152, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-12" }),
  cost("Book Off นา", { jpy: 12154, thb: 2532, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-12" }),
];
const day7SusukinoCosts = [
  cost("เจงกิสข่าน", { jpy: 10400, thb: 2166, category: "อาหาร", paymentMethod: CARD_X, date: "2026-02-12" }),
  cost("Donki บาส", { jpy: 17260, thb: 3595, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-12" }),
  cost("Donki นา", { jpy: 20791, thb: 4331, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-12" }),
];

const day8OtaruCosts = [
  cost("รถไฟไปต่อ JR Otaru", { jpy: 420, thb: 87, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-13" }),
  cost("Kitaca", { jpy: 4000, thb: 833, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-13" }),
  cost("Matcha Latte", { jpy: 450, thb: 94, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("Matcha ผง", { jpy: 1350, thb: 281, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("Ice cream", { jpy: 480, thb: 100, category: "อาหาร", paymentMethod: CASH, date: "2026-02-13" }),
  cost("หมึกนา", { jpy: 2592, thb: 540, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("หมึกบาส", { jpy: 2592, thb: 540, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("อูนิ Otaru", { jpy: 12529, thb: 2610, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("ร้านยา นา", { jpy: 11780, thb: 2454, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("ร้านยา บาส", { jpy: 11666, thb: 2430, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("ขนม", { jpy: 3430, thb: 715, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("ยา รอบสอง", { jpy: 14980, thb: 3120, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("Donki", { jpy: 9647, thb: 2010, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("เนื้อย่าง", { jpy: 10351, thb: 2156, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-13" }),
  cost("รถไฟกลับ Susukino", { jpy: 420, thb: 87, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-13" }),
  cost("JR ไป Otaru ไปกลับ", { jpy: 2800, thb: 583, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-13" }),
];

const day9ShoppingCosts = [
  cost("รถไฟไป", { jpy: 420, thb: 87, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-14" }),
  cost("ขนม Snow Cheese", { jpy: 7344, thb: 1530, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("รถไฟกลับ", { jpy: 420, thb: 87, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-14" }),
  cost("รองเท้า", { jpy: 14000, thb: 2916, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("โทนเนอร์ + ลิป", { jpy: 1207, thb: 251, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Ice cream", { jpy: 650, thb: 135, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Matcha Latte", { jpy: 500, thb: 104, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Pure Matcha", { jpy: 500, thb: 104, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Matcha Powder", { jpy: 2800, thb: 583, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("FamilyMart ถุงเท้า", { jpy: 3142, thb: 655, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Lawson ลูกอม", { jpy: 929, thb: 194, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
  cost("Halal Meal", { jpy: 11540, thb: 2404, category: "อาหาร", paymentMethod: CASH, date: "2026-02-14" }),
  cost("เครื่องสำอาง นา", { jpy: 3850, thb: 802, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-14" }),
];

const day10AirportCosts = [
  cost("ค่ารถไปสนามบิน", { jpy: 2600, thb: 542, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-15" }),
  cost("ค่ารถขากลับ", { thb: 500, category: "เดินทาง", paymentMethod: CASH, date: "2026-02-15" }),
];
const day10ShoppingCosts = [
  cost("ขนมสนามบิน", { jpy: 27612, thb: 5753, category: "Shopping", paymentMethod: CARD_X, date: "2026-02-15" }),
  cost("ขนมสนามบิน 2", { jpy: 2984, thb: 622, category: "อาหาร", paymentMethod: YOU_TRIP, date: "2026-02-15" }),
  cost("NY เงินสด", { jpy: 5000, thb: 1042, category: "Shopping", paymentMethod: CASH, date: "2026-02-15" }),
  cost("NY YouTrip", { jpy: 4000, thb: 833, category: "Shopping", paymentMethod: YOU_TRIP, date: "2026-02-15" }),
];

const itinerary = [
  { day: 1, time: "19:00", name: "ออกเดินทางไป Hokkaido", address: "Bangkok → New Chitose Airport", mode: "เครื่องบิน", detail: "เที่ยวบินขาไปคืนวันที่ 6 ก.พ. และถึง New Chitose Airport เวลา 08:20 น. วันที่ 7 ก.พ.", costs: plannedCosts },
  { day: 2, time: "08:20", name: "ถึง New Chitose Airport", address: "New Chitose Airport", mode: "รถบัส", detail: "เดินไปฝั่ง Domestic เพื่อกด IC Card Kitaca แล้วนั่ง Airport Bus เข้า Sapporo ประมาณ 70 นาที ค่าโดยสาร ¥1,300 รถรอบแรก 12:05 ถึงประมาณ 13:13 น. จากนั้นเดินต่อ 650 เมตร ประมาณ 10 นาที", costs: day2BusCosts },
  { day: 2, time: "13:40", name: "Tsudome Site ❅", address: "Sapporo Snow Festival 76th", mode: "รถไฟ", detail: "กิจกรรมในเทศกาลหิมะ เช่น สไลเดอร์ เปิด 10:00–16:00 น. เข้าฟรี", costs: [] },
  { day: 2, time: "16:30", name: "Odori Park ❅", address: "Odori Park, Sapporo", mode: "รถไฟ", detail: "ชมเทศกาลหิมะ 4–11 ก.พ. เปิดไฟถึง 22:00 น. แวะซื้อ Royce ข้างสวนก่อน 20:00 น. ข้อมูล: https://www.snowfes.com/", costs: day2OdoriCosts },
  { day: 2, time: "18:30", name: "Sapporo Beer Museum", address: "Sapporo Beer Museum", mode: "รถไฟ", detail: "พิพิธภัณฑ์เปิด 11:00–18:00 น. มีเจงกิสข่านที่ Sapporo Beer Garden ร้านอาหารปิด 21:00 น.", costs: [] },
  { day: 2, time: "21:00", name: "Susukino ❅", address: "Susukino, Sapporo", mode: "เดิน", detail: "เดินชมงานแกะสลักน้ำแข็ง เปิดไฟถึง 23:00 น. ซื้อถุงให้ความอุ่นตาม convenience store", costs: day2SusukinoCosts },
  { day: 2, time: "23:00", name: "Vessel Hotel Campana Susukino", address: "Sapporo", detail: "รวมอาหารเช้าและมีออนเซ็น", costs: [] },

  { day: 3, time: "08:15", name: "รับรถเช่า", address: "Sapporo", mode: "รถยนต์", detail: "ตื่น 06:00 น. ออกจากโรงแรม 08:15 น. รับรถ 09:00 น. เช่า ETC ธรรมดา ไม่ต้องเหมา HEP และขับไป Asahikawa เผื่อเวลาเพิ่ม 1 ชั่วโมง", costs: day3DriveCosts },
  { day: 3, time: "12:30", name: "Asahiyama Zoo", address: "Asahikawa", mode: "รถยนต์", detail: "พาเหรดเพนกวินเวลา 11:00 และ 14:30 น. สวนสัตว์ปิด 15:30 น.", costs: day3ZooCosts },
  { day: 3, time: "16:00", name: "Uniqlo & GU", address: "Asahikawa", mode: "รถยนต์", detail: "แวะระหว่างกลับเข้าเมือง อยู่ใกล้ Asahikawa Ramen Village", costs: day3ShoppingCosts },
  { day: 3, time: "18:30", name: "Yakiniku Wajima", address: "Asahikawa", mode: "รถยนต์", detail: "ร้านเนื้อวากิวจาก Furano เปิด 11:00–00:30 น.", costs: day3DinnerCosts },
  { day: 3, time: "20:30", name: "AEON Asahikawa", address: "Asahikawa", mode: "เดิน", detail: "AEON Asahikawa Ekimae หน้าโรงแรมปิด 22:00 น. และ AEON Asahikawa Nishi ปิด 23:00 น.", costs: day3AeonCosts },
  { day: 3, time: "22:00", name: "Hotel Wing International Asahikawa Ekimae", address: "Asahikawa", detail: "รวมอาหารเช้า", costs: [] },

  { day: 4, time: "08:00", name: "ออกเดินทางไป Furano", address: "Asahikawa → Furano", mode: "รถยนต์", detail: "ตื่น 06:00 น. เผื่อเวลากวาดหิมะที่รถก่อนออกเดินทาง", costs: day4MorningCosts },
  { day: 4, time: "09:00", name: "Mild Seven Hill", address: "Biei", mode: "รถยนต์", detail: "ขับรถประมาณ 28 นาที", costs: [] },
  { day: 4, time: "10:00", name: "Biei City", address: "Biei", mode: "รถยนต์", detail: "แวะเที่ยวเมือง Biei ขับจาก Mild Seven Hill ประมาณ 10 นาที", costs: [] },
  { day: 4, time: "11:00", name: "Christmas Tree", address: "Biei", mode: "รถยนต์", detail: "ขับจากเมือง Biei ประมาณ 13 นาที", costs: [] },
  { day: 4, time: "12:00", name: "Shirahige Waterfall", address: "Biei", mode: "รถยนต์", detail: "ขับจาก Christmas Tree ประมาณ 30 นาที", costs: [] },
  { day: 4, time: "14:00", name: "Kan Kan Mura", address: "Furano", mode: "รถยนต์", detail: "เล่น Banana Boat และกิจกรรมหิมะ งานจัดไฟ ค่าเข้า ¥300 ได้เล่น Tubing ฟรี 1 ครั้ง ปิด 19:30 น.", costs: day4KanKanCosts },
  { day: 4, time: "16:00", name: "Ningle Terrace", address: "Furano", mode: "รถยนต์", detail: "ขับรถประมาณ 5 นาที ปิด 19:45 น.", costs: day4NingleCosts },
  { day: 4, time: "20:00", name: "La Vista Furano Hills", address: "Furano", detail: "รวมอาหารเช้า มี Private Onsen กลับมาแช่ออนเซ็น และเวลา 22:00 น. มีราเม็งกับไอศกรีมฟรี", costs: [] },

  { day: 5, time: "08:00", name: "La Vista Furano Hills", address: "Furano", mode: "รถยนต์", detail: "กินข้าว แช่ออนเซ็น และใช้ facility โรงแรมก่อนออกเวลา 10:00 น.", costs: [] },
  { day: 5, time: "10:30", name: "Cheese Factory", address: "Furano Cheese Factory", mode: "รถยนต์", detail: "แวะ Cheese Factory ก่อนเดินทางต่อ", costs: day5CheeseCosts },
  { day: 5, time: "13:00", name: "เดินทางไป Jozankei", address: "Furano → Jozankei", mode: "รถยนต์", detail: "เริ่มเดินทาง 13:00 น. เผื่อขับรถและกินข้าวรวมประมาณ 3 ชั่วโมง", costs: day5DriveCosts },
  { day: 5, time: "16:00", name: "Jozankei View Hotel", address: "Jozankei", detail: "รวมอาหารเช้าและอาหารเย็น มีออนเซ็นชั้น B และชั้น 16 หาเวลาใช้ห้องซักผ้าสำหรับ Heattech ถุงเท้า และเสื้อผ้า", costs: [] },

  { day: 6, time: "10:00", name: "Futamitsuri Bridge", address: "Jozankei", mode: "เดิน", detail: "เที่ยวสะพานแดงและเดินเล่นใน Jozankei", costs: [] },
  { day: 6, time: "11:00", name: "Kokorono-sato", address: "Jozankei", mode: "เดิน", detail: "คาเฟ่และ Onsen เปิด 10:00–18:00 น.", costs: day6FoodCosts },
  { day: 6, time: "14:00", name: "Hoheikyo Hot Spring", address: "Jozankei", mode: "รถยนต์", detail: "ออนเซ็น outdoor เก่าแก่ใน Jozankei", costs: day6OnsenCosts },
  { day: 6, time: "18:00", name: "Jozankei View Hotel", address: "Jozankei", detail: "กลับโรงแรมและรับประทานอาหารเย็นที่โรงแรม", costs: [] },

  { day: 7, time: "09:00", name: "ออกจาก Jozankei", address: "Jozankei → Sapporo", mode: "รถยนต์", detail: "ออกจาก Jozankei เวลา 09:00 น.", costs: [] },
  { day: 7, time: "11:00", name: "คืนรถที่ Susukino", address: "Susukino, Sapporo", mode: "รถไฟ", detail: "ขับรถประมาณ 45 นาที จองรถไว้ถึง 12:00 น.", costs: day7ReturnCarCosts },
  { day: 7, time: "14:00", name: "Shiroi Koibito Park", address: "Sapporo", mode: "รถบัส", detail: "โรงงานช็อกโกแลตเปิด 10:00–19:00 น. ขนมปิด 16:00 น. วางแผนเที่ยว 14:00–17:00 น. ใช้รถไฟประมาณ 26 นาที ที่โรงงานไม่ทำ Tax Refund แนะนำซื้อข้างนอกหรือสนามบิน", costs: day7ChocolateCosts },
  { day: 7, time: "17:30", name: "BOOKOFF SUPER BAZAAR", address: "5gou Sapporo Miyanosawa Store", mode: "รถไฟ", detail: "เปิด 10:00–21:00 น.", costs: day7BookOffCosts },
  { day: 7, time: "20:00", name: "Susukino", address: "Sapporo", mode: "เดิน", detail: "กลับเข้าเมือง กินเจงกิสข่านและแวะ Don Quijote", costs: day7SusukinoCosts },
  { day: 7, time: "22:30", name: "Vessel Hotel Campana Susukino", address: "Sapporo", detail: "รวมอาหารเช้าและมีออนเซ็น", costs: [] },

  { day: 8, time: "08:00", name: "เดินทางไป Otaru", address: "Sapporo → Otaru", mode: "รถไฟ", detail: "นั่งรถไฟประมาณ 50 นาที ร้านส่วนใหญ่ปิด 17:30–18:00 น.", costs: [] },
  { day: 8, time: "10:00", name: "Otaru", address: "Otaru, Hokkaido", mode: "รถไฟ", detail: "เที่ยวคลอง Otaru และอยู่ชมเทศกาลไฟกลางคืน 7–14 ก.พ. เปิดไฟ 17:00–21:00 น.", costs: day8OtaruCosts },

  { day: 9, time: "08:00", name: "Daimaru Sapporo", address: "Sapporo", mode: "เดิน", detail: "ต่อคิวซื้อ Snow Cheese ซึ่งมีขายเฉพาะ Hokkaido", costs: day9ShoppingCosts },
  { day: 9, time: "11:00", name: "Shopping ย่าน Susukino", address: "Susukino, Sapporo", mode: "เดิน", detail: "สำรวจราคาก่อนเลือกร้าน แวะ Sundrug ซึ่งมีข้อมูลว่าราคาถูกกว่า Don Quijote", costs: [] },
  { day: 9, time: "20:00", name: "เตรียมเดินทางกลับ", address: "Vessel Hotel Campana Susukino", detail: "เช็กอากาศวันถัดไป หากเสี่ยงพายุหิมะและ Airport Bus อาจยกเลิก ให้ใช้ JR โดยไปขึ้นที่ Sapporo Station ให้ทันรอบ 06:00 น. หรือให้โรงแรมเรียก Taxi แต่เช้า", costs: [] },

  { day: 10, time: "05:00", name: "ออกจากที่พักไปสนามบิน", address: "Vessel Hotel Campana Susukino → New Chitose Airport", mode: "รถบัส", detail: "ขึ้น Airport Bus หน้าโรงแรมรอบ 05:20 น. ออกเช้าเพื่อเผื่อเวลาต่อคิว", costs: day10AirportCosts },
  { day: 10, time: "08:00", name: "New Chitose Airport", address: "New Chitose Airport", mode: "เครื่องบิน", detail: "หากมีเวลา เก็บ Stamp ให้ครบ 6 จุดแล้วนำไปแลกรางวัล", costs: day10ShoppingCosts },
  { day: 10, time: "10:00", name: "บินกลับประเทศไทย", address: "New Chitose Airport → Bangkok", detail: "เที่ยวบินกลับ 10:00–15:50 น. จากนั้นเดินทางกลับลำลูกกา", costs: [] },
];

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const tripResult = await client.query("SELECT id,total_days FROM trips WHERE name=$1 FOR UPDATE", ["Hokkaido 2026"]);
  if (tripResult.rowCount !== 1) throw new Error(`Expected exactly one Hokkaido 2026 trip, found ${tripResult.rowCount}`);
  const trip = tripResult.rows[0];
  if (trip.total_days < 10) throw new Error("Hokkaido 2026 must have at least 10 days");
  const existing = await client.query("SELECT count(*)::int AS count FROM itineraries WHERE trip_id=$1", [trip.id]);
  if (existing.rows[0].count > 0) {
    await client.query("ROLLBACK");
    console.log(`Skipped: Hokkaido 2026 already has ${existing.rows[0].count} Timeline items.`);
  } else {
    for (const [index, item] of itinerary.entries()) {
      const hour = Number(item.time.slice(0, 2));
      const slot = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      await client.query(
        `INSERT INTO itineraries (trip_id,day_number,time_slot,start_time,place_name,address,transport_mode,transport_note,cost_items,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [trip.id, item.day, slot, item.time, item.name, item.address ?? null, item.mode ?? null, item.detail ?? null, JSON.stringify(item.costs ?? []), index],
      );
    }
    await client.query("COMMIT");
    const expenseCount = itinerary.reduce((sum, item) => sum + (item.costs?.length ?? 0), 0);
    const expenseTotal = itinerary.flatMap(item => item.costs ?? []).reduce((sum, item) => sum + item.value, 0);
    console.log(`Seeded Hokkaido 2026: ${itinerary.length} Timeline items, ${expenseCount} expenses, THB ${expenseTotal.toFixed(2)}.`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
