"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Gift, Pencil, ShoppingBag } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import { budgetAmountSatang, formatBudgetAmount } from "@/src/lib/budget-allocation";

const money=(value:number)=>value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
export function PersonalShoppingSummary({tripId,budget,shopping,souvenirs,balance,pending,onSaved}:{
  tripId:string;budget:number;shopping:number;souvenirs:number;balance:number;pending:number;onSaved:(budget:number)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [value,setValue]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const spent=shopping+souvenirs;
  const remaining=budget-spent;
  async function save(){
    setBusy(true);setError("");
    try{
      const amount=budgetAmountSatang(value)/100;
      const response=await fetch(`/api/trips/${tripId}/shopping-budget`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({budget:amount}),signal:AbortSignal.timeout(20000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"บันทึกไม่สำเร็จ");
      onSaved(Number(data.budget));setOpen(false);
    }catch(reason){setError(reason instanceof Error?reason.message:"บันทึกไม่สำเร็จ กรุณาลองใหม่");}finally{setBusy(false);}
  }
  return <section className="personal-shopping-summary">
    <header><h3><ShoppingBag size={18}/>งบ Shopping ของฉัน</h3><button type="button" className="icon-btn" aria-label="แก้ไขงบ Shopping ของฉัน" onClick={()=>{setValue(formatBudgetAmount(budget));setError("");setOpen(true);}}><Pencil size={16}/></button></header>
    <p>รวม Shopping และของฝาก เฉพาะส่วนของฉัน</p>
    <div className="personal-shopping-stats">
      <div><span>งบของฉัน</span><strong>฿{money(budget)}</strong></div>
      <div><span>ใช้ไปแล้ว</span><strong>฿{money(spent)}</strong></div>
      <div className={remaining<0?"is-over":"is-remaining"}><span>{remaining<0?"เกินงบ":"คงเหลือ"}</span><strong>฿{money(Math.abs(remaining))}</strong></div>
    </div>
    <div className="personal-shopping-breakdown"><span><ShoppingBag size={14}/>Shopping <b>฿{money(shopping)}</b></span><span><Gift size={14}/>ของฝาก <b>฿{money(souvenirs)}</b></span></div>
    {balance!==0&&<p className="personal-shopping-clearing">{balance>0?"รับคืนจาก Shopping / ของฝาก":"คืนเงินค่า Shopping / ของฝาก"} <b>฿{money(Math.abs(balance))}</b> · แยกจากยอดเคลียร์งบหลัก</p>}
    {pending>0&&<p>ยอดเคลียร์ Shopping ยังไม่ครบ {pending} รายการ กรุณาระบุผู้จ่ายและผู้รับผิดชอบให้ครบ</p>}
    {open&&createPortal(<BottomSheet title="งบ Shopping ของฉัน" subtitle="งบส่วนตัวสำหรับ Shopping และของฝากในทริปนี้" onClose={()=>setOpen(false)} busy={busy} className="personal-shopping-budget-sheet" backdropClassName="budget-allocation-backdrop" submitLabel={busy?"กำลังบันทึก…":"บันทึกงบของฉัน"} onSubmit={event=>{event.preventDefault();return save();}}>
      <label className="field personal-shopping-budget-field"><span>จำนวนเงิน (THB)</span><input aria-label="งบ Shopping ของฉัน" inputMode="decimal" placeholder="0" value={value} onChange={event=>setValue(formatBudgetAmount(event.target.value))}/></label>
      {error&&<p className="workspace-error" role="alert">{error}</p>}
    </BottomSheet>,document.body)}
  </section>;
}
