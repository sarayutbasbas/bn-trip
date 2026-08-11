import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/src/lib/db";
import { createSession, SESSION_COOKIE } from "@/src/lib/auth";

const schema = z.object({ sharedId: z.string().min(3).max(60), password: z.string().min(6).max(100) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await query<{ id:string; shared_id:string; password_hash:string }>("SELECT id, shared_id, password_hash FROM users WHERE lower(shared_id) = lower($1) LIMIT 1", [input.sharedId]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) return NextResponse.json({ error: "ID หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    const token = await createSession(user.id, user.shared_id);
    const response = NextResponse.json({ ok: true, sharedId: user.shared_id });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production", path:"/", maxAge:60*60*24*30 });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "กรุณากรอก Shared Trip ID และรหัสผ่านให้ครบ" }, { status: 400 });
    }
    console.error("BN Trip login database error", error);
    return NextResponse.json(
      { error: "ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาเปิด PostgreSQL ด้วย docker compose up db -d" },
      { status: 503 },
    );
  }
}
