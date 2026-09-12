"use client";

import { useEffect,useMemo,useState,type FormEvent,type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp,CalendarRange,ChartNoAxesColumnIncreasing,CheckCircle2,Compass,House,MapPin,MapPinned,PlaneTakeoff,Plus,Settings2,Sparkles,Trash2,UserPlus,X } from "lucide-react";
import type { TripIdea,TripIdeaKind,TripIdeaMember } from "@/src/lib/trip-ideas";
import { countryByCode,formatTripDestination,TRIP_COUNTRIES } from "@/src/lib/countries";
import { TRIP_DESTINATION_OPTIONS,type TripDestinationOption } from "@/src/lib/travel-badges";
import { ConfirmDialog,CountryFlagImage,CoverImagePicker,TripDestinationPicker,type Confirmation } from "@/src/components/bn-trip-app";

type IdeaDraft={name:string;countryCode:string;locationIds:string[];kind:TripIdeaKind;targetMonth:number|null;targetYear:number|null;note:string;coverImageUrl:string};
type IdeaEditor={idea:TripIdea|null;promote:boolean};
type IdeaCollaborator={id:string;email:string;user_id:string|null;joined:boolean;display_name:string|null;avatar_url:string|null};
const monthNames=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function sortIdeas(items:TripIdea[]){return [...items].sort((a,b)=>a.kind!==b.kind?(a.kind==="planned"?-1:1):a.kind==="planned"?((a.target_year||9999)-(b.target_year||9999)||(a.target_month||99)-(b.target_month||99)):a.created_at.localeCompare(b.created_at))}
async function readResponse(response:Response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");return data}
function stop(event:{stopPropagation:()=>void}){event.stopPropagation()}

function IdeaAvatars({members,open}:{members:TripIdeaMember[];open:()=>void}){
  const owner=members.find(member=>member.role==="owner");
  const others=members.filter(member=>member.role!=="owner");
  const hasOverflow=members.length>3;
  const visible=[...others.slice(0,owner?(hasOverflow?1:2):(hasOverflow?2:3)),...(owner?[owner]:[])];
  const hidden=Math.max(0,members.length-visible.length);
  return <button type="button" className="trip-idea-avatars" onClick={event=>{stop(event);open()}} aria-label={`ผู้ร่วมวางแผน ${members.length} คน`} title="ผู้ร่วมวางแผน">
    {visible.map(member=><span key={member.id} className={member.role==="owner"?"is-owner":""} style={member.avatar_url?{backgroundImage:`url("${member.avatar_url}")`}:undefined} title={member.display_name||member.email}>{!member.avatar_url&&(member.display_name||member.email||"?").charAt(0).toUpperCase()}</span>)}
    {hidden>0?<span className="is-more">+{hidden}</span>:null}
  </button>;
}

function IdeaCard({idea,edit,promote,convert,share}:{idea:TripIdea;edit:()=>void;promote?:()=>void;convert?:()=>void;share:()=>void}){
  const today=new Date();const monthDistance=idea.target_year&&idea.target_month?(idea.target_year-today.getFullYear())*12+idea.target_month-(today.getMonth()+1):null;
  const expired=idea.kind==="planned"&&monthDistance!==null&&monthDistance<0;
  const country=countryByCode(idea.country_code);
  const status=idea.kind==="someday"?"ยังไม่กำหนดช่วงเวลา":expired?"เลยช่วงที่เล็งไว้แล้ว":monthDistance===0?"คาดว่าจะไปภายในเดือนนี้":`กำลังจะถึงในอีก ${monthDistance} เดือน`;
  const activate=(event:KeyboardEvent<HTMLElement>)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();edit()}};
  return <article className={`compact-trip-card trip-idea-card is-${idea.kind} ${idea.members?.length>1?"has-shared-members":""}`} role="button" tabIndex={0} onClick={edit} onKeyDown={activate} aria-label={`แก้ไข ${idea.name}`}>
    <div className="compact-trip-cover"><Image className="compact-trip-cover-image" src={idea.cover_image_url||"/travel-postcard-fallback.jpg"} alt={`รูปปก ${idea.name}`} fill sizes="(max-width: 639px) 36vw, 220px" unoptimized/></div>
    <div className="compact-trip-body trip-idea-copy"><b className={`compact-trip-status ${expired?"trip-idea-expired":""}`}><span>{status}</span></b><h3>{idea.name}</h3>
      <p>{country?<span className="trip-country-flag"><CountryFlagImage code={country.code} label=""/></span>:<MapPinned size={13}/>}<span>{formatTripDestination(idea.destination,idea.country_code,country?.nameEn)}</span></p>
      <small>{idea.kind==="planned"?`คาดว่าจะไปช่วง ${monthNames[(idea.target_month||1)-1]} ${idea.target_year}`:"ยังไม่ได้กำหนดเดือนและปี"}</small>
      {idea.note?<small>{idea.note}</small>:null}
      {promote?<button className="trip-idea-promote" type="button" onClick={event=>{stop(event);promote()}}><ArrowUp size={15}/> กำหนดช่วงเวลา</button>:null}
      {convert?<button className="trip-idea-convert" type="button" onClick={event=>{stop(event);convert()}}><PlaneTakeoff size={15}/> สร้างเป็นทริปจริง</button>:null}
      <IdeaAvatars members={idea.members||[]} open={share}/>
    </div>
  </article>;
}

function IdeaForm({editor,close,save,requestDelete,busy}:{editor:IdeaEditor;close:()=>void;save:(draft:IdeaDraft)=>Promise<void>;requestDelete:()=>void;busy:boolean}){
  const current=editor.idea;const promote=editor.promote;
  const initialCountry=countryByCode(current?.country_code)||TRIP_COUNTRIES[0];
  const [name,setName]=useState(current?.name||"");
  const [countryCode,setCountryCode]=useState(initialCountry.code);
  const [locations,setLocations]=useState<TripDestinationOption[]>(()=>current?.trip_destinations.map(saved=>{
    const option=TRIP_DESTINATION_OPTIONS.find(candidate=>candidate.id===saved.id);
    return option||{...saved,searchTerms:[saved.nameTh,saved.nameEn].filter(Boolean)} as TripDestinationOption;
  })||[]);
  const [kind,setKind]=useState<TripIdeaKind>(promote?"planned":current?.kind||"planned");
  const [targetMonth,setTargetMonth]=useState<number|null>(promote?null:current?.target_month||new Date().getMonth()+1);
  const [targetYear,setTargetYear]=useState<number|null>(promote?null:current?.target_year||new Date().getFullYear()+1);
  const [note,setNote]=useState(current?.note||"");const [coverFile,setCoverFile]=useState<File|null>(null);const [error,setError]=useState("");
  async function submit(event:FormEvent){event.preventDefault();setError("");try{if(!locations.length)throw new Error("กรุณาเลือกเมืองหรือจังหวัดอย่างน้อย 1 แห่ง");let coverImageUrl=current?.cover_image_url||"/travel-postcard-fallback.jpg";if(coverFile){const upload=new FormData();upload.set("file",coverFile);coverImageUrl=(await readResponse(await fetch("/api/uploads",{method:"POST",body:upload}))).url}await save({name,countryCode,locationIds:locations.map(location=>location.id),kind,targetMonth,targetYear,note,coverImageUrl})}catch(caught){setError((caught as Error).message)}}
  return <div className="trip-idea-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close()}}><form className="trip-idea-modal" onSubmit={submit}>
    <div className="trip-idea-modal-head"><div><span>{promote?"MOVE TO THE RADAR":current?"EDIT TRIP IDEA":"NEW TRIP IDEA"}</span><h2>{promote?"กำหนดช่วงเวลาที่อยากไป":current?"แก้ไขรายการ":"เพิ่มสถานที่ที่อยากไป"}</h2></div><button type="button" onClick={close} disabled={busy} aria-label="ปิด"><X size={19}/></button></div>
    <CoverImagePicker existingUrl={current?.cover_image_url||"/travel-postcard-fallback.jpg"} onChange={setCoverFile}/>
    <label className="trip-idea-field"><span>ชื่อทริป</span><input required maxLength={160} value={name} onChange={event=>setName(event.target.value)} placeholder="เช่น Fukuoka Food Trip"/></label>
    <div className="field country-select-field"><label>ประเทศ</label><div className="country-select-control"><CountryFlagImage code={countryCode} label="" className="country-select-flag"/><select name="countryCode" value={countryCode} onChange={event=>{setCountryCode(event.target.value);setLocations([])}}>{TRIP_COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.nameTh}</option>)}</select></div><small>เลือกประเทศก่อน แล้วจึงค้นหาเมืองด้านล่าง</small></div>
    <TripDestinationPicker countryCode={countryCode} selected={locations} onChange={setLocations}/>
    <fieldset className="trip-idea-kind-picker"><legend>วางไว้ในลิสต์ไหน</legend><button type="button" className={kind==="planned"?"active":""} onClick={()=>{setKind("planned");setTargetMonth(targetMonth||1);setTargetYear(targetYear||new Date().getFullYear()+1)}}><CalendarRange size={17}/><span>ทริปที่เล็งไว้<small>มีเดือนและปีคร่าว ๆ</small></span></button><button type="button" className={kind==="someday"?"active":""} onClick={()=>{setKind("someday");setTargetMonth(null);setTargetYear(null)}}><Compass size={17}/><span>ลิสต์สักวันหนึ่ง<small>ยังไม่รู้ว่าจะไปเมื่อไร</small></span></button></fieldset>
    {kind==="planned"?<div className="trip-idea-date-row"><label className="trip-idea-field"><span>เดือน</span><select required value={targetMonth||""} onChange={event=>setTargetMonth(event.target.value?Number(event.target.value):null)}><option value="" disabled>เลือกเดือน</option>{monthNames.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><label className="trip-idea-field"><span>ปี ค.ศ.</span><input required type="number" min="2020" max="2200" value={targetYear||""} onChange={event=>setTargetYear(event.target.value?Number(event.target.value):null)}/></label></div>:null}
    <label className="trip-idea-field"><span>โน้ต <small>(ไม่บังคับ)</small></span><textarea maxLength={500} value={note} onChange={event=>setNote(event.target.value)} placeholder="สิ่งที่อยากทำ เหตุผลที่อยากไป หรือไอเดียคร่าว ๆ"/></label>
    {error?<p className="trip-idea-error">{error}</p>:null}
    <div className="modal-submit-actions trip-idea-submit-actions"><button className="primary-btn" disabled={busy||!name.trim()||(kind==="planned"&&(!targetMonth||!targetYear))}>{busy?"กำลังบันทึก…":promote?"เลื่อนขึ้นและบันทึกช่วงเวลา":"บันทึก"}</button>{current?.access_role==="owner"?<button className="delete-record-btn" type="button" onClick={requestDelete} disabled={busy} aria-label="ลบรายการ" title="ลบรายการ"><Trash2 size={18}/></button>:null}</div>
  </form></div>;
}

function IdeaCollaboratorsSheet({idea,close,onChanged,confirm,notify}:{idea:TripIdea;close:()=>void;onChanged:()=>void;confirm:(value:Confirmation)=>void;notify:(message:string)=>void}){
  const canManage=idea.access_role==="owner";const [items,setItems]=useState<IdeaCollaborator[]>([]);const [recent,setRecent]=useState<string[]>([]);const [email,setEmail]=useState("");const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{Promise.all([fetch(`/api/trip-ideas/${idea.id}/collaborators`),fetch("/api/collaborators/recent")]).then(async([membersResponse,recentResponse])=>{const members=await readResponse(membersResponse);const contacts=await recentResponse.json();setItems(members);setRecent(Array.isArray(contacts)?contacts.map(contact=>contact.email):[])}).catch(reason=>setError(reason instanceof Error?reason.message:"โหลดผู้ร่วมวางแผนไม่สำเร็จ")).finally(()=>setLoading(false))},[idea.id]);
  async function add(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const added=await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}));setItems(old=>[...old.filter(item=>item.id!==added.id),added]);setRecent(old=>[added.email,...old.filter(value=>value!==added.email)]);setEmail("");onChanged();notify("เพิ่มผู้ร่วมวางแผนแล้ว")}catch(reason){setError((reason as Error).message)}finally{setSaving(false)}}
  async function remove(item:IdeaCollaborator){await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators/${item.id}`,{method:"DELETE"}));setItems(old=>old.filter(row=>row.id!==item.id));onChanged();notify("ลบผู้ร่วมวางแผนแล้ว")}
  const suggestions=recent.filter(value=>!items.some(item=>item.email===value));
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal collaborators-sheet"><div className="modal-head"><div><h2>ผู้ร่วมวางแผน</h2><p>{canManage?"แชร์รายการนี้ให้เพื่อนช่วยดูและแก้ไขข้อมูลร่วมกัน":"รายชื่อผู้ที่วางแผนรายการนี้ร่วมกัน"}</p></div><button type="button" className="icon-btn" onClick={close} aria-label="ปิด"><X size={18}/></button></div>
    {canManage?<form className="collaborator-form" onSubmit={add}><div className="field"><label>อีเมลผู้ร่วมวางแผน</label><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="friend@gmail.com" value={email} onChange={event=>setEmail(event.target.value)} required/></div><button className="primary-btn" disabled={saving||!email.trim()}><UserPlus size={16}/>{saving?"กำลังเพิ่ม…":"เพิ่มผู้ร่วมวางแผน"}</button>{suggestions.length?<div className="recent-collaborators"><small>เลือกจากคนที่เพิ่มล่าสุด</small><div>{suggestions.map(value=><button type="button" key={value} onClick={()=>setEmail(value)}>{value}</button>)}</div></div>:null}</form>:null}
    {error?<p className="login-error">{error}</p>:null}<div className="collaborator-list">{loading?<p>กำลังโหลด…</p>:items.length?items.map(item=><div className={`collaborator-row idea-collaborator-row ${canManage?"":"is-readonly"}`} key={item.id}><span className="collaborator-avatar" style={item.avatar_url?{backgroundImage:`url("${item.avatar_url}")`}:undefined}>{!item.avatar_url&&(item.display_name||item.email).charAt(0).toUpperCase()}</span><div className="collaborator-copy"><strong>{item.display_name||item.email}</strong><small>{item.display_name?item.email:item.joined?"เข้าร่วมแล้ว":"แชร์ด้วยอีเมลแล้ว"}</small></div>{canManage?<button type="button" className="delete-record-btn" onClick={()=>confirm({title:`ลบผู้ร่วมวางแผน “${item.email}”?`,description:"บุคคลนี้จะไม่สามารถเปิดหรือแก้ไขรายการนี้ได้อีก",confirmLabel:"ลบผู้ร่วมวางแผน",onConfirm:()=>remove(item)})} aria-label="ลบผู้ร่วมวางแผน"><Trash2 size={17}/></button>:<span className="collaborator-access-badge is-view">ร่วมวางแผน</span>}</div>):<p className="collaborator-empty">ยังไม่มีผู้ร่วมวางแผน</p>}</div>
  </section></div>;
}

export function TripIdeasPage({initialIdeas,demo}:{initialIdeas:TripIdea[];demo:boolean}){
  const router=useRouter();const [ideas,setIdeas]=useState(()=>sortIdeas(initialIdeas));const [editing,setEditing]=useState<IdeaEditor>();const [sharing,setSharing]=useState<TripIdea|null>(null);const [confirmation,setConfirmation]=useState<Confirmation|null>(null);const [busy,setBusy]=useState(false);const [toast,setToast]=useState("");
  const grouped=useMemo(()=>({planned:ideas.filter(idea=>idea.kind==="planned"),someday:ideas.filter(idea=>idea.kind==="someday")}),[ideas]);
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2400)}
  function openForm(idea:TripIdea|null,promote=false){if(demo){notify("เข้าสู่ระบบเพื่อเพิ่มหรือแก้ไขรายการ");return}setEditing({idea,promote})}
  async function save(draft:IdeaDraft){setBusy(true);try{const current=editing?.idea||null;const saved=await readResponse(await fetch(current?`/api/trip-ideas/${current.id}`:"/api/trip-ideas",{method:current?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)})) as TripIdea;setIdeas(items=>sortIdeas(current?items.map(item=>item.id===saved.id?saved:item):[...items,saved]));setEditing(undefined);notify(current?"บันทึกการแก้ไขแล้ว":"เพิ่มลงลิสต์แล้ว")}finally{setBusy(false)}}
  async function remove(idea:TripIdea){await readResponse(await fetch(`/api/trip-ideas/${idea.id}`,{method:"DELETE"}));setIdeas(items=>items.filter(item=>item.id!==idea.id));setEditing(undefined);notify("ลบออกจากลิสต์แล้ว")}
  function askRemove(idea:TripIdea){setConfirmation({title:`ลบ “${idea.name}” ออกจากลิสต์?`,description:"รายการ รูปปก และการแชร์กับผู้ร่วมวางแผนจะถูกลบถาวร",confirmLabel:"ลบรายการ",onConfirm:()=>remove(idea)})}
  async function refreshIdea(id:string){try{const fresh=await readResponse(await fetch(`/api/trip-ideas/${id}`,{cache:"no-store"})) as TripIdea;setIdeas(items=>items.map(item=>item.id===id?fresh:item));setSharing(current=>current?.id===id?fresh:current)}catch{}}
  function convertToTrip(idea:TripIdea){if(demo){notify("เข้าสู่ระบบเพื่อสร้างทริปจริง");return}router.push(`/?tripIdea=${encodeURIComponent(idea.id)}`)}
  const cards=(items:TripIdea[],someday=false)=>items.length?items.map(idea=><IdeaCard key={idea.id} idea={idea} edit={()=>openForm(idea)} promote={someday?()=>openForm(idea,true):undefined} convert={!someday?()=>convertToTrip(idea):undefined} share={()=>setSharing(idea)}/>):<div className="trip-ideas-empty">{someday?<Compass size={25}/>:<CalendarRange size={25}/>}<strong>{someday?"ลิสต์นี้ยังว่าง":"ยังไม่มีทริปที่กำหนดช่วงเวลา"}</strong><span>{someday?"เก็บเมือง ประเทศ หรือสถานที่ที่อยากไปไว้ก่อนได้":"เพิ่มเมืองที่เล็งไว้ พร้อมเดือนและปีคร่าว ๆ ได้เลย"}</span></div>;
  return <div className="app-shell flow-shell trip-ideas-page-shell">{toast?<div className="toast toast-success" role="status"><CheckCircle2 size={17}/>{toast}</div>:null}<main><header className="mobile-head flow-header"><Link className="brand" href="/" aria-label="Pack & Go+ · หน้าแรก"><Image src="/pack-and-go-icon-512.png" alt="Pack & Go+" width={48} height={48} priority/><div>Pack &amp; Go+<small>travel smarter together</small></div></Link><nav className="mobile-actions" aria-label="เมนูหลัก"><Link className="icon-btn" href="/" aria-label="หน้าแรก" title="หน้าแรก"><House size={18}/></Link><Link className="icon-btn" href="/settings" aria-label="ตั้งค่า" title="ตั้งค่า"><Settings2 size={18}/></Link></nav></header><div className="trip-ideas-screen"><section className="trip-ideas-hero"><nav className="welcome-shortcuts hero-shortcuts" aria-label="ทางลัด"><Link className="welcome-insights-btn" href="/"><House size={15}/><span>Home</span></Link><Link className="welcome-insights-btn" href="/badges"><MapPin size={15}/><span>เข็มกลัด</span></Link><Link className="welcome-insights-btn" href="/analytics"><ChartNoAxesColumnIncreasing size={15}/><span>สถิติ</span></Link></nav><div><span><Sparkles size={14}/> FUTURE JOURNEYS</span><h1>ทริปที่เล็งไว้</h1><p>เก็บแพลนที่อยากไปในอนาคตไว้ที่เดียว ทั้งทริปที่มีช่วงเวลาคร่าว ๆ และสถานที่ในฝันที่ยังไม่รีบกำหนดวัน</p></div><button type="button" onClick={()=>openForm(null)}><Plus size={18}/> เพิ่มสถานที่</button></section><section className="trip-ideas-section"><div className="trip-ideas-section-head"><div><span>NEXT ON THE RADAR</span><h2>ทริปที่มีช่วงเวลาในใจ</h2><p>เรียงตามเดือนและปี เพื่อให้มองเห็นแพลนระยะยาวได้ง่าย</p></div><b>{grouped.planned.length}</b></div><div className="trip-ideas-grid">{cards(grouped.planned)}</div></section><section className="trip-ideas-section someday-section"><div className="trip-ideas-section-head"><div><span>SOMEDAY LIST</span><h2>สถานที่ที่อยากไปสักวัน</h2><p>ไอเดียที่ยังไม่ต้องผูกกับปฏิทิน จะได้ไม่ลืมว่าครั้งหนึ่งเราเคยอยากไป</p></div><b>{grouped.someday.length}</b></div><div className="trip-ideas-grid">{cards(grouped.someday,true)}</div></section></div></main><button className="trip-ideas-fab" type="button" onClick={()=>openForm(null)} aria-label="เพิ่มสถานที่"><Plus size={22}/></button>
    {editing?<IdeaForm key={`${editing.idea?.id||"new"}:${editing.promote}`} editor={editing} close={()=>setEditing(undefined)} save={save} requestDelete={()=>editing.idea&&askRemove(editing.idea)} busy={busy}/>:null}
    {sharing?<IdeaCollaboratorsSheet key={sharing.id} idea={sharing} close={()=>setSharing(null)} onChanged={()=>void refreshIdea(sharing.id)} confirm={setConfirmation} notify={notify}/>:null}
    {confirmation?<ConfirmDialog confirmation={confirmation} close={()=>setConfirmation(null)}/>:null}
  </div>;
}
