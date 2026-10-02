export const DEFAULT_COVER = "/travel-postcard-fallback.jpg";
export type CoverRecord = { cover_image_url?: string | null; cover_image_urls?: string[] | null };
export function tripCovers(record: CoverRecord): string[] {
  const urls = record.cover_image_urls?.filter((url) => typeof url === "string" && url.trim()) || [];
  return [...new Set(urls.length ? urls : [record.cover_image_url || DEFAULT_COVER])].slice(0, 4);
}
export function chooseCoverLayout(urls: string[], random = Math.random): string[] {
  if (urls.length < 2 || random() < 0.5) {
    if (urls.length < 2) return urls;
    const value = random();
    return [urls[value < 0.5 ? 0 : 1 + Math.min(urls.length - 2, Math.floor((value - 0.5) * 2 * (urls.length - 1)))]];
  }
  return urls;
}
export type CoverDraft = string | File;
export async function uploadTripCovers(covers: CoverDraft[]): Promise<string[]> {
  if (covers.length > 4) throw new Error("เพิ่มรูปปกได้สูงสุด 4 รูป");
  if (!covers.length) return [DEFAULT_COVER];
  const urls: string[] = [];
  for (const cover of covers) {
    if (typeof cover === "string") { urls.push(cover); continue; }
    const body = new FormData(); body.set("file", cover);
    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result.url !== "string" || !result.url) throw new Error(`รูปที่ ${urls.length + 1}: ${result.error || (response.status === 413 ? "ไฟล์รูปใหญ่เกินไป กรุณาลดขนาดรูปแล้วลองอีกครั้ง" : "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง")}`);
    urls.push(result.url);
  }
  return urls;
}
