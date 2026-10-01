import { z } from "zod";
export const tripCoverUrlsSchema = z.array(z.string().min(1).max(2000).refine(
  (url) => (url.startsWith("/") && !url.startsWith("//")) || /^https:\/\//i.test(url),
  "URL รูปปกไม่ถูกต้อง",
)).min(1).max(4, "เพิ่มรูปปกได้สูงสุด 4 รูป");
