export const CHECKLIST_CATEGORY_ICON_KEYS = [
  "plane",
  "shirt",
  "laptop",
  "medical",
  "sparkles",
  "heart",
  "shower",
  "scissors",
  "watch",
  "passport",
  "camera",
  "flashlight",
  "house",
  "wallet",
  "food",
  "bed",
  "shopping",
  "baby",
  "pet",
  "help",
] as const;

export type ChecklistCategoryIconKey =
  (typeof CHECKLIST_CATEGORY_ICON_KEYS)[number];

export const CHECKLIST_CATEGORY_ICON_LABELS: Record<
  ChecklistCategoryIconKey,
  string
> = {
  plane: "การเดินทาง",
  shirt: "เสื้อผ้า",
  laptop: "อุปกรณ์ไอที",
  medical: "ยาและสุขภาพ",
  sparkles: "เครื่องสำอาง",
  heart: "ดูแลผิว",
  shower: "ของใช้ในห้องน้ำ",
  scissors: "ผมและการดูแล",
  watch: "เครื่องประดับ",
  passport: "เอกสารสำคัญ",
  camera: "กล้องถ่ายรูป",
  flashlight: "อุปกรณ์ฉุกเฉิน",
  house: "ของใช้ในบ้าน",
  wallet: "เงินและบัตร",
  food: "อาหาร",
  bed: "ที่พัก",
  shopping: "ช้อปปิ้ง",
  baby: "เด็ก",
  pet: "สัตว์เลี้ยง",
  help: "จัดหมวดหมู่ไม่ได้",
};

export function inferChecklistCategoryIcon(
  value: string,
): ChecklistCategoryIconKey {
  const name = value.toLocaleLowerCase("th");
  if (/เที่ยว|เดินทาง|flight|airport|ก่อนออก/.test(name)) return "plane";
  if (/เสื้อ|clothes|กระเป๋าเสื้อ/.test(name)) return "shirt";
  if (/ไอที|คอม|notebook|laptop|ชาร์|สายชาร์|อิเล็ก/.test(name)) return "laptop";
  if (/ยา|สุขภาพ|พยาบาล|แอลกอฮอล์|medical/.test(name)) return "medical";
  if (/makeup|เครื่องสำอาง|คสอ/.test(name)) return "sparkles";
  if (/skin|ผิว|กันแดด/.test(name)) return "heart";
  if (/toiletries|ห้องน้ำ|อาบน้ำ|แปรงสีฟัน|แชมพู/.test(name)) return "shower";
  if (/hair|ผม|หวี|ไดร์/.test(name)) return "scissors";
  if (/accessories|เครื่องประดับ|นาฬิกา|แหวน|สร้อย/.test(name)) return "watch";
  if (/passport|เอกสาร|บัตรประชาชน|supporter/.test(name)) return "passport";
  if (/กล้อง|camera|เลนส์/.test(name)) return "camera";
  if (/ฉุกเฉิน|ภัยพิบัติ|ไฟฉาย/.test(name)) return "flashlight";
  if (/บ้าน|house|เคลียร์/.test(name)) return "house";
  if (/เงิน|บัตรเครดิต|wallet/.test(name)) return "wallet";
  if (/อาหาร|ขนม|food|มาม่า/.test(name)) return "food";
  if (/โรงแรม|ที่พัก|hotel/.test(name)) return "bed";
  if (/ช้อป|shopping|ของฝาก/.test(name)) return "shopping";
  if (/เด็ก|baby/.test(name)) return "baby";
  if (/สัตว์|หมา|แมว|pet/.test(name)) return "pet";
  return "help";
}

export function normalizeChecklistCategoryIcon(
  iconKey: string | null | undefined,
  categoryName: string,
): ChecklistCategoryIconKey {
  return CHECKLIST_CATEGORY_ICON_KEYS.includes(
    iconKey as ChecklistCategoryIconKey,
  )
    ? (iconKey as ChecklistCategoryIconKey)
    : inferChecklistCategoryIcon(categoryName);
}
