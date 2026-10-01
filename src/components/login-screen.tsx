"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, MapPinned, Moon, PlaneTakeoff, ShieldCheck, Sparkles, Sun, Wallet } from "lucide-react";

const identity = (text: string) => text;

export function LoginScreen({ authError, translate = identity }: { authError?: string; translate?: (text: string) => string }) {
  const t = translate;
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try { localStorage.setItem("bn-theme", next ? "dark" : "light"); } catch { /* Theme still works without storage. */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#000000" : "#f2f2f7");
  }
  const error = authError
    ? authError === "google_not_configured" ? "ยังไม่ได้ตั้งค่า Google OAuth"
      : authError === "demo_login_required" ? "เข้าสู่ระบบเพื่อเพิ่ม แก้ไข หรือลบข้อมูล"
        : "เข้าสู่ระบบด้วย Google ไม่สำเร็จ"
    : "";

  return <main className="login-page login-redesign">
    <header className="signin-header">
      <Link className="signin-brand" href="/" aria-label="RouteRao · หน้าแรก">
        <Image src="/routerao-logo-transparent-512.png" alt="" width={42} height={42} priority />
        <span>RouteRao<small>TRAVEL SMARTER TOGETHER</small></span>
      </Link>
      <button type="button" className="signin-theme" onClick={toggleTheme} aria-label={dark ? t("เปลี่ยนเป็นธีมสว่าง") : t("เปลี่ยนเป็นธีมมืด")} aria-pressed={dark}>
        <Sun className="signin-sun" size={20} /><Moon className="signin-moon" size={20} />
      </button>
    </header>
    <div className="signin-layout">
      <section className="signin-story" aria-labelledby="signin-title">
        <p className="signin-eyebrow"><span /> YOUR NEXT CHAPTER</p>
        <h1 id="signin-title">{t("ทุกทริปที่ฝันไว้")}<br /><em>{t("เริ่มต้นที่นี่")}</em><span className="signin-heading-spark" aria-hidden="true">✳</span></h1>
        <p className="signin-description">{t("วางแผน เก็บความทรงจำ และแชร์ค่าใช้จ่าย")}<br />{t("ให้ทุกการเดินทางเป็นเรื่องง่ายไปด้วยกัน")}</p>
        <div className="signin-postcards" aria-hidden="true">
          <div className="signin-orbit" />
          <div className="signin-postcard-back" />
          <div className="signin-postcard">
            <Image src="/travel-postcard-fallback.jpg" alt="" fill sizes="(min-width: 900px) 340px, 260px" priority />
            <span className="signin-postcard-stamp"><PlaneTakeoff size={19} /> LET’S GO</span>
            <div><small>A LITTLE PLAN. A GREAT JOURNEY.</small><strong>Good trips,<br />happier us.</strong></div>
          </div>
          <div className="signin-ticket"><span><MapPinned size={19} /></span><div><small>THE NEXT DESTINATION</small><strong>{t("ที่ไหนก็ได้… ไปด้วยกัน")}</strong></div><Sparkles size={16} /></div>
        </div>
        <div className="signin-features">
          <span><MapPinned size={15} />{t("แพลนทริป")}</span>
          <span><Wallet size={15} />{t("แชร์ค่าใช้จ่าย")}</span>
          <span><Camera size={15} />{t("เก็บโมเมนต์")}</span>
        </div>
      </section>
      <section className="signin-access" aria-labelledby="signin-access-title">
        <div className="signin-access-icon"><PlaneTakeoff size={22} /></div>
        <div className="signin-access-copy"><span>READY WHEN YOU ARE</span><h2 id="signin-access-title">{t("เปิดสมุดเดินทางของคุณ")}</h2><p>{t("ทริปดี ๆ ครั้งต่อไป กำลังรออยู่")}</p></div>
        {error ? <p className="signin-error" role="alert">{t(error)}</p> : null}
        <a className="signin-google" href="/api/auth/google"><span className="google-mark" aria-hidden="true">G</span><span>{t("เข้าสู่ระบบด้วย Google")}</span><ArrowRight size={19} /></a>
        <div className="signin-divider"><span />{t("หรือแวะดูก่อน")}<span /></div>
        <a className="signin-demo" href="/api/auth/demo"><Sparkles size={18} /><span>{t("ทดลองใช้ก่อน")}</span><ArrowRight size={18} /></a>
        <p className="signin-hint"><ShieldCheck size={14} />{t("ใช้บัญชี Google ของคุณได้เลย ไม่ต้องตั้งรหัสผ่านใหม่")}</p>
      </section>
    </div>
    <footer className="signin-footer">MADE FOR YOUR JOURNEYS <span>✦</span> MADE TOGETHER</footer>
  </main>;
}
