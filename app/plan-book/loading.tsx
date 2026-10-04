import styles from "@/src/components/plan-book.module.css";

export default function Loading() {
  return <main className={styles.shell} aria-busy="true" aria-label="กำลังเปิดสมุดแพลน">
    <header className={styles.header}><h1>สมุดแพลน</h1></header>
    <div className={styles.intro}><span>กำลังรวบรวมการเดินทางของคุณ…</span></div>
    <div className={styles.stage}><div className={`${styles.book} ${styles.skeleton}`} /></div>
  </main>;
}
