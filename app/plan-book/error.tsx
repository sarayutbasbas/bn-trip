"use client";
import Link from "next/link";
import styles from "@/src/components/plan-book.module.css";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className={styles.shell}><div className={styles.empty}>
    <h1>เปิดสมุดแพลนไม่สำเร็จ</h1><p>ลองโหลดอีกครั้ง ข้อมูลแพลนของคุณยังอยู่เหมือนเดิม</p>
    <button type="button" onClick={reset}>ลองอีกครั้ง</button><Link href="/">กลับหน้าหลัก</Link>
  </div></main>;
}
