"use client";

import Image from "next/image";
import { useCallback,useEffect,useRef,useState } from "react";
import { Bell,Check,MapPin,Plane,Trash2,Users } from "lucide-react";

export type InvitationNotification = {
  id:string;
  invitation_type:"trip"|"trip_idea";
  trip_id:string|null;
  trip_idea_id:string|null;
  created_at:string;
  trip_name:string;
  destination:string;
  cover_image_url:string|null;
  owner_name:string;
  owner_email:string;
  owner_avatar_url:string|null;
};

type InvitationResult={id:string;invitation_type:"trip"|"trip_idea";trip_id:string|null;trip_idea_id:string|null};

async function readResponse(response:Response){
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"ดำเนินการไม่สำเร็จ");
  return data;
}

export function InvitationNotifications({onChanged}:{onChanged?:(result:InvitationResult)=>void|Promise<void>}){
  const rootRef=useRef<HTMLDivElement>(null);
  const [items,setItems]=useState<InvitationNotification[]>([]);
  const [open,setOpen]=useState(false);
  const [busyId,setBusyId]=useState("");
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    try{
      const data=await readResponse(await fetch("/api/invitations",{cache:"no-store"}));
      setItems(Array.isArray(data)?data:[]);
    }catch{
      setItems([]);
      setOpen(false);
    }
  },[]);
  useEffect(()=>{
    const initialLoad=window.setTimeout(()=>void load(),0);
    const refresh=()=>void load();
    const visibility=()=>{if(document.visibilityState==="visible")void load()};
    window.addEventListener("focus",refresh);
    window.addEventListener("invitation-notifications:refresh",refresh);
    document.addEventListener("visibilitychange",visibility);
    return()=>{
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus",refresh);
      window.removeEventListener("invitation-notifications:refresh",refresh);
      document.removeEventListener("visibilitychange",visibility);
    };
  },[load]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!rootRef.current?.contains(event.target as Node))setOpen(false)};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape)};
  },[open]);
  async function respond(invitation:InvitationNotification,method:"PATCH"|"DELETE"){
    setBusyId(invitation.id);setError("");
    try{
      const result=await readResponse(await fetch(`/api/invitations/${invitation.id}`,{method})) as InvitationResult;
      const next=items.filter(item=>item.id!==invitation.id);
      setItems(next);
      if(!next.length)setOpen(false);
      if(method==="PATCH"){
        sessionStorage.setItem(`invitation:accepted:${result.invitation_type}`,"1");
        await onChanged?.(result);
      }
    }catch(caught){setError(caught instanceof Error?caught.message:"ดำเนินการไม่สำเร็จ")}
    finally{setBusyId("")}
  }
  const hasItems=items.length>0;
  return <div className="invitation-notification" ref={rootRef}>
    <button className="icon-btn home-notification-btn" type="button" onClick={()=>{if(hasItems)setOpen(value=>!value)}} aria-label="การแจ้งเตือน" title="การแจ้งเตือน" aria-expanded={hasItems?open:false} aria-haspopup={hasItems?"dialog":undefined}>
      <Bell size={24}/>{hasItems?<i className="notification-dot"/>:null}
    </button>
    {open&&hasItems?<section className="invitation-popover" role="dialog" aria-label="คำเชิญใหม่">
      <div className="invitation-popover-list">
        {items.map(invitation=><article className="invitation-popover-card" key={invitation.id}>
          <Image src={invitation.cover_image_url||"/travel-postcard-fallback.jpg"} alt="" width={62} height={62} unoptimized/>
          <div className="invitation-popover-copy"><span className={`invitation-kind is-${invitation.invitation_type}`}>{invitation.invitation_type==="trip_idea"?<Users size={11}/>:<Plane size={11}/>} {invitation.invitation_type==="trip_idea"?"ทริปที่เล็งไว้":"ทริป"}</span><strong>{invitation.trip_name}</strong><small><MapPin size={10}/>{invitation.destination}</small><p>{invitation.owner_name||invitation.owner_email} เชิญคุณเข้าร่วม</p></div>
          <div className="invitation-popover-actions">
            <button className="invitation-popover-accept" type="button" onClick={()=>void respond(invitation,"PATCH")} disabled={Boolean(busyId)} aria-label={`ยอมรับคำเชิญ ${invitation.trip_name}`} title="ยอมรับ" aria-busy={busyId===invitation.id}><Check size={21}/></button>
            <button className="invitation-popover-decline" type="button" onClick={()=>void respond(invitation,"DELETE")} disabled={Boolean(busyId)} aria-label={`ปฏิเสธคำเชิญ ${invitation.trip_name}`} title="ปฏิเสธ"><Trash2 size={21}/></button>
          </div>
        </article>)}
      </div>
      {error?<p className="invitation-popover-error">{error}</p>:null}
    </section>:null}
  </div>;
}
