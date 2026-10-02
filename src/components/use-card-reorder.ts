"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

// Long press selects a source; a separate tap selects its destination.
// There is no drag loop, pointer capture, or automatic page scrolling.
export function useCardReorder<T extends {id: string}>(items: T[], save: (items: T[]) => Promise<void>) {
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [draft,setDraft] = useState(items);
  const stopPending = useRef<(() => void)|null>(null);
  const mounted = useRef(true);
  function cancel(){stopPending.current?.();setSelectedId(null);setMessage("");}
  function select(id:string){
    if(saving)return;
    setSelectedId(current=>current===id?null:id);
    setMessage("แตะบัตรปลายทางเพื่อย้ายมาที่ตำแหน่งนั้น");
  }
  function pointerDown(event:PointerEvent<HTMLButtonElement>,id:string){
    if(saving || (event.pointerType === "mouse" && event.button !== 0))return;
    stopPending.current?.();
    const x=event.clientX,y=event.clientY,pointerId=event.pointerId;
    const stop=()=>{clearTimeout(timer);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);window.removeEventListener("pointercancel",stop);stopPending.current=null};
    const move=(next:globalThis.PointerEvent)=>{if(next.pointerId===pointerId&&Math.hypot(next.clientX-x,next.clientY-y)>10)stop()};
    const timer=setTimeout(()=>{stop();select(id)},350);
    stopPending.current=stop;
    window.addEventListener("pointermove",move,{passive:true});window.addEventListener("pointerup",stop);window.addEventListener("pointercancel",stop);
  }
  async function place(targetId:string){
    if(!selectedId||saving)return;
    if(targetId===selectedId){cancel();return;}
    const from=items.findIndex(item=>item.id===selectedId),to=items.findIndex(item=>item.id===targetId);
    if(from<0||to<0){cancel();return;}
    const next=[...items], [moved]=next.splice(from,1);next.splice(to,0,moved);
    setDraft(next);setSelectedId(null);setSaving(true);
    try{await save(next);if(mounted.current)setMessage("บันทึกลำดับบัตรแล้ว")}
    catch{if(mounted.current)setMessage("บันทึกลำดับไม่สำเร็จ กรุณาลองอีกครั้ง")}
    finally{if(mounted.current)setSaving(false)}
  }
  useEffect(()=>{
    mounted.current=true;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")cancel()};
    window.addEventListener("keydown",escape);
    return()=>{mounted.current=false;stopPending.current?.();window.removeEventListener("keydown",escape)};
  },[]);
  return {selectedId,ordered:saving?draft:items,saving,message,pointerDown,select,place,cancel};
}
