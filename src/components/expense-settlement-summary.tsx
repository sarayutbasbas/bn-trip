"use client";

import { expenseSettlement, type SettlementExpense } from "@/src/lib/expense-settlement";

export function ExpenseSettlementSummary({ costs, members, guests }: {
  costs: SettlementExpense[];
  members: { id: string; display_name: string | null; email: string | null }[];
  guests: { id: string; name: string }[];
}) {
  const result = expenseSettlement(costs, members.map(member => member.id), guests.map(guest => guest.id));
  const people = [
    ...members.map(member => ({ key: `member:${member.id}`, name: member.display_name || member.email || "สมาชิก" })),
    ...guests.map(guest => ({ key: `guest:${guest.id}`, name: `${guest.name} (คนนอก)` })),
  ];
  const money = (satang: number) => `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (!people.length) return null;
  return <section className="expense-settlement-summary" aria-label="สรุปเคลียร์เงิน">
    <h3>สรุปเคลียร์เงิน</h3>
    <p>ยอดที่ออกเงินไป − ส่วนที่ต้องรับผิดชอบ = ยอดรับคืนหรือจ่ายเพิ่ม</p>
    {result.pendingCount > 0 ? <p className="expense-settlement-warning" role="status">
      ยังสรุปไม่ครบ: {result.pendingCount} รายการ ({money(result.pendingAmount)}) ยังไม่ระบุผู้จ่ายหรือผู้หารไม่ครบ กรุณาแก้ไขรายการเหล่านี้ ยอดด้านล่างคิดเฉพาะรายการที่ข้อมูลครบแล้ว
    </p> : <p>รวมค่าใช้จ่ายทริปและ Shopping · ยอดสุทธิก่อนโอนเคลียร์เงิน</p>}
    <div className="expense-settlement-rows">{people.map(person => {
      const row = result.rows.get(person.key)!;
      return <article key={person.key}>
        <strong>{person.name}</strong>
        <div><span>ออกเงินไป <b>{money(row.paid)}</b></span><span>ส่วนรับผิดชอบ <b>{money(row.share)}</b></span></div>
        <p className={row.balance > 0 ? "is-receivable" : row.balance < 0 ? "is-payable" : "is-balanced"}>
          {row.balance > 0 ? "ต้องได้รับคืน" : row.balance < 0 ? "ต้องจ่ายเพิ่ม" : "ยอดสมดุล"} <b>{money(Math.abs(row.balance))}</b>
        </p>
      </article>;
    })}</div>
  </section>;
}
