"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Crown, Plane, Sparkles } from "lucide-react";

export function LoginScreen({ authError }: { authError?: string }) {
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
          <Link className="brand" href="/" aria-label="BN Trip · หน้าแรก">
            <Image src="/bn-trip-icon-orange-512.png" alt="BN Trip" width={48} height={48} priority />
            <div>BN Trip<small>our tiny trip club</small></div>
          </Link>
          <span className="login-private-pill"><Crown size={12} />พื้นที่ส่วนตัว</span>
        </div>
        <div className="login-hero-copy">
          <div className="eyebrow"><Sparkles size={13} /> private journeys · made together</div>
          <h1>เก็บทุกเส้นทาง<br />ไว้ในที่เดียว</h1>
          <p>แพลนที่เที่ยว จดโมเมนต์ และคุมงบ<br />ในสมุดเดินทางของ B &amp; N</p>
          <div className="login-route"><span>BKK</span><div><Plane size={20} /></div><span>ANYWHERE</span></div>
        </div>
      </section>
      <section className="login-panel">
        <span className="login-sheet-handle" aria-hidden="true" />
        <div className="login-copy"><span className="mini-kicker">WELCOME BACK</span><h2>เปิดสมุดเดินทาง</h2><p>เข้าสู่ระบบด้วย Google Account ของคุณ</p></div>
        {error && <p className="login-error">{error}</p>}
        <a className="primary-btn google-login-btn" href="/api/auth/google"><span className="google-mark">G</span><span>เข้าสู่ระบบด้วย Google</span><ArrowRight size={17} /></a>
        <a className="demo-login-btn" href="/api/auth/demo"><Sparkles size={16} /><span>ทดลองใช้ก่อน</span><ArrowRight size={16} /></a>
        <p className="login-hint"><Crown size={12} />ทุกบัญชี Google สามารถเริ่มสร้างทริปได้</p>
      </section>
    </main>
  );
}
