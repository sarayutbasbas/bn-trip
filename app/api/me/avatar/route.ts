import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { saveUpload, deleteUpload } from "@/src/lib/storage";
import { scheduleUnusedImageCleanup } from "@/src/lib/unused-images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบเพื่อเปลี่ยนรูปโปรไฟล์", loginRequired: true }, { status: 403 });
  let filename: string | undefined;
  let committed = false;
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return NextResponse.json({ error: "รองรับรูป JPG, PNG และ WebP" }, { status: 400 });
    if (!file.size || file.size > 3 * 1024 * 1024)
      return NextResponse.json({ error: "รูปต้องมีขนาดไม่เกิน 3 MB" }, { status: 400 });
    let image: Buffer;
    try {
      image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40000000 })
        .rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82, effort: 5 }).toBuffer();
    } catch {
      return NextResponse.json({ error: "ไม่สามารถอ่านไฟล์รูปนี้ได้" }, { status: 400 });
    }
    filename = `${randomUUID()}.webp`;
    const url = await saveUpload(filename, image, "image/webp");
    const result = await transaction(async client => {
      const previous = await client.query("SELECT avatar_url FROM users WHERE id=$1 FOR UPDATE", [session.userId]);
      if (!previous.rows.length) throw new Error("Account not found");
      const updated = await client.query("UPDATE users SET avatar_url=$1,updated_at=now() WHERE id=$2 RETURNING id,email,display_name,avatar_url", [url, session.userId]);
      return { account: updated.rows[0], previous: previous.rows[0].avatar_url as string | null };
    });
    committed = true;
    scheduleUnusedImageCleanup(result.previous ? [result.previous] : [], [url]);
    return NextResponse.json(result.account);
  } catch (error) {
    if (filename && !committed) await deleteUpload(filename).catch(() => {});
    console.error("Avatar upload failed", error);
    return NextResponse.json({ error: "บันทึกรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
