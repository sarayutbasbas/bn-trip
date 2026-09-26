"use client";

import { useEffect,useMemo,useState,type FormEvent,type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays,CalendarRange,CheckCircle2,Compass,Globe2,Heart,LogOut,Luggage,MapPin,MapPinned,PlaneTakeoff,Plus,RefreshCw,RotateCcw,Search,Settings2,Trash2,UserPlus,X } from "lucide-react";
import type { TripIdea,TripIdeaKind,TripIdeaMember } from "@/src/lib/trip-ideas";
import { getCurrentAccount } from "@/src/lib/client-account";
import { countryByCode,formatTripDestination,TRIP_COUNTRIES } from "@/src/lib/countries";
import { TRIP_DESTINATION_OPTIONS,type TripDestinationOption } from "@/src/lib/travel-badges";
import { ConfirmDialog,CountryFlagImage,CountryPicker,CoverImagePicker,TripDestinationPicker,type Confirmation } from "@/src/components/bn-trip-app";
import { PageIntro } from "@/src/components/page-intro";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { InvitationNotifications,type InvitationNotification } from "@/src/components/invitation-notifications";
import { FormErrorDialog } from "@/src/components/form-error-dialog";
import { scrollPageToTopAfterOverlay } from "@/src/lib/client-scroll";
import { TripNoteField } from "@/src/components/trip-note-field";
import { TripSegmentedFilter, type TripFilterOption } from "@/src/components/trip-segmented-filter";

type IdeaDraft={name:string;countryCode:string;locationIds:string[];kind:TripIdeaKind;targetMonth:number|null;targetYear:number|null;note:string;coverImageUrl:string};
type IdeaEditor={idea:TripIdea|null;promote:boolean};
type IdeaCollaborator={id:string;email:string;user_id:string|null;joined:boolean;display_name:string|null;avatar_url:string|null};
type HeaderProfile={id:string;email:string;display_name:string;avatar_url:string|null};
type IdeaTripType="all"|"domestic"|"international";
const monthNames=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function timestamp(value:string){const parsed=Date.parse(value);return Number.isNaN(parsed)?0:parsed}
function sortIdeas(items:TripIdea[]){return [...items].sort((a,b)=>a.kind!==b.kind?(a.kind==="planned"?-1:1):a.kind==="planned"?((a.target_year||9999)-(b.target_year||9999)||(a.target_month||99)-(b.target_month||99)):timestamp(b.created_at)-timestamp(a.created_at))}
async function readResponse(response:Response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");return data}
function stop(event:{stopPropagation:()=>void}){event.stopPropagation()}
function ideaCountdown(idea:TripIdea){
  if(!idea.target_year||!idea.target_month)return null;
  const now=new Date();
  const months=(idea.target_year-now.getFullYear())*12+(idea.target_month-(now.getMonth()+1));
  if(months<0)return "เลยกำหนดแล้ว";
  if(months===0)return "เดือนนี้";
  const years=Math.floor(months/12);const remainingMonths=months%12;
  if(!years)return `อีก ${remainingMonths} เดือน`;
  return remainingMonths?`อีก ${years} ปี ${remainingMonths} เดือน`:`อีก ${years} ปี`;
}
function ideaTargetDate(idea:TripIdea){
  if(!idea.target_year||!idea.target_month)return null;
  return new Date(idea.target_year,idea.target_month-1,1).toLocaleDateString("th-TH",{month:"short",year:"2-digit"});
}
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

function IdeaCard({idea,edit,convert,share}:{idea:TripIdea;edit:()=>void;convert?:()=>void;share:()=>void}){
  const country=countryByCode(idea.country_code);
  const detail=(idea.note||"").trim();
  const countdown=ideaCountdown(idea);
  const targetDate=ideaTargetDate(idea);
  const activate=(event:KeyboardEvent<HTMLElement>)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();edit()}};
  return <article className={`compact-trip-card trip-idea-card is-${idea.kind} ${idea.members?.length>1?"has-shared-members":""}`} role="button" tabIndex={0} onClick={edit} onKeyDown={activate} aria-label={`แก้ไข ${idea.name}`}>
    <div className="compact-trip-cover"><Image className="compact-trip-cover-image" src={idea.cover_image_url||"/travel-postcard-fallback.jpg"} alt={`รูปปก ${idea.name}`} fill sizes="(max-width: 639px) 42vw, 260px" unoptimized/>{countdown?<span className="trip-idea-countdown"><PlaneTakeoff size={11}/>{countdown}</span>:null}</div>
    <div className="compact-trip-body trip-idea-copy"><h3>{idea.name}</h3>
      <p>{country?<span className="trip-country-flag"><CountryFlagImage code={country.code} label=""/></span>:<MapPinned size={13}/>}<span>{formatTripDestination(idea.destination,idea.country_code,country?.nameTh,idea.trip_destinations)}</span></p>
      {targetDate?<small className="trip-idea-target-date"><CalendarDays size={11}/><span>{targetDate}</span></small>:null}
      {detail?<small className="trip-idea-note">{detail}</small>:null}
      <div className="trip-idea-card-footer"><IdeaAvatars members={idea.members||[]} open={share}/>{idea.kind==="planned"&&convert?<button className="trip-idea-convert" type="button" onClick={event=>{stop(event);convert()}}><PlaneTakeoff size={15}/> สร้างทริป</button>:null}</div>
    </div>
  </article>;
}

function IdeaForm({editor,close,save,requestDelete,busy}:{editor:IdeaEditor;close:()=>void;save:(draft:IdeaDraft)=>Promise<void>;requestDelete:()=>void;busy:boolean}){
  const current=editor.idea;const promote=editor.promote;
  const currentYear=new Date().getFullYear();
  const yearOptions=Array.from({length:21},(_,index)=>currentYear+index);
  const savedYear=current?.target_year;
  const defaultYear=savedYear&&savedYear>=currentYear&&savedYear<=currentYear+20?savedYear:currentYear+1;
  const initialCountry=countryByCode(current?.country_code)||TRIP_COUNTRIES[0];
  const [name,setName]=useState(current?.name||"");
  const [countryCode,setCountryCode]=useState(initialCountry.code);
  const [locations,setLocations]=useState<TripDestinationOption[]>(()=>current?.trip_destinations?.map(saved=>{
    const option=TRIP_DESTINATION_OPTIONS.find(candidate=>candidate.id===saved.id);
    return option||{...saved,searchTerms:[saved.nameTh,saved.nameEn].filter(Boolean)} as TripDestinationOption;
  })||[]);
  const [kind,setKind]=useState<TripIdeaKind>(promote?"planned":current?.kind||"planned");
  const [targetMonth,setTargetMonth]=useState<number|null>(promote||current?.kind==="someday"?null:current?.target_month||new Date().getMonth()+1);
  const [targetYear,setTargetYear]=useState<number|null>(promote||current?.kind==="someday"?null:defaultYear);
  const [note,setNote]=useState(current?.note||"");const [coverFile,setCoverFile]=useState<File|null>(null);const [error,setError]=useState("");
  const validationIncomplete=!name.trim()||!locations.length||(kind==="planned"&&(!targetMonth||!targetYear));
  const locationIds=locations.map(location=>location.id).sort();
  const originalLocationIds=(current?.trip_destinations||[]).map(location=>location.id).sort();
  const unchanged=Boolean(current)&&!coverFile&&name.trim()===(current?.name||"").trim()&&countryCode===(current?.country_code||initialCountry.code)&&locationIds.join("|")===originalLocationIds.join("|")&&kind===current?.kind&&targetMonth===(current?.target_month||null)&&targetYear===(current?.target_year||null)&&note.trim()===(current?.note||"").trim();
  async function submit(event:FormEvent){event.preventDefault();setError("");try{if(!locations.length)throw new Error("กรุณาเลือกเมืองหรือจังหวัดอย่างน้อย 1 แห่ง");let coverImageUrl=current?.cover_image_url||"/travel-postcard-fallback.jpg";if(coverFile){const upload=new FormData();upload.set("file",coverFile);const uploaded=await readResponse(await fetch("/api/uploads",{method:"POST",body:upload}));if(typeof uploaded.url!=="string"||!uploaded.url)throw new Error("ไม่พบ URL ของรูปที่อัปโหลด");coverImageUrl=uploaded.url}await save({name,countryCode,locationIds:locations.map(location=>location.id),kind,targetMonth,targetYear,note,coverImageUrl});scrollPageToTopAfterOverlay()}catch(caught){setError((caught as Error).message)}}
  return <><BottomSheet
    title={promote?"กำหนดช่วงเวลาที่อยากไป":current?"แก้ไขรายการ":"เพิ่มสถานที่ที่อยากไป"}
    subtitle={promote?"เลือกเดือนและปีเพื่อย้ายมาเป็นทริปที่เล็งไว้":current?"แก้ไขข้อมูลของทริปที่เล็งไว้หรือลิสต์สักวันหนึ่ง":"บันทึกสถานที่ที่อยากเดินทางไปในอนาคต"}
    onClose={close}
    onSubmit={submit}
    busy={busy}
    submitLabel={busy?"กำลังบันทึก…":promote?"เลื่อนขึ้นและบันทึกช่วงเวลา":"บันทึก"}
    submitDisabled={busy||(!validationIncomplete&&unchanged)}
    onDelete={current?requestDelete:undefined}
    deleteDisabled={busy}
    deleteLabel={current?.access_role==="owner"?"ลบรายการ":"ออกจากทริปที่เล็งไว้"}
    deleteIcon={current?.access_role==="collaborator"?<LogOut size={18}/>:undefined}
  >
    <div className="form-grid trip-idea-form-grid">
    <CoverImagePicker existingUrl={current?.cover_image_url||null} onChange={setCoverFile}/>
    <label className="trip-idea-field"><span>ชื่อทริป</span><input required maxLength={160} value={name} onChange={event=>setName(event.target.value)} placeholder="เช่น Fukuoka Food Trip"/></label>
    <CountryPicker value={countryCode} onChange={nextCountryCode=>{setCountryCode(nextCountryCode);setLocations([])}} note="เลือกประเทศก่อน แล้วจึงค้นหาเมืองด้านล่าง"/>
    <TripDestinationPicker countryCode={countryCode} selected={locations} onChange={setLocations}/>
    <fieldset className="trip-idea-kind-picker"><legend>วางไว้ในลิสต์ไหน</legend><button type="button" className={kind==="planned"?"active":""} onClick={()=>{setKind("planned");setTargetMonth(targetMonth||1);setTargetYear(targetYear||defaultYear)}}><CalendarRange size={17}/><span>ทริปที่เล็งไว้<small>มีเดือนและปีคร่าว ๆ</small></span></button><button type="button" className={kind==="someday"?"active":""} onClick={()=>{setKind("someday");setTargetMonth(null);setTargetYear(null)}}><Compass size={17}/><span>ลิสต์สักวันหนึ่ง<small>ยังไม่รู้ว่าจะไปเมื่อไร</small></span></button></fieldset>
    {kind==="planned"?<div className="trip-idea-date-row"><label className="trip-idea-field"><span>เดือน</span><select required value={targetMonth||""} onChange={event=>setTargetMonth(event.target.value?Number(event.target.value):null)}><option value="" disabled>เลือกเดือน</option>{monthNames.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><label className="trip-idea-field"><span>ปี ค.ศ.</span><select required value={targetYear||""} onChange={event=>setTargetYear(event.target.value?Number(event.target.value):null)}><option value="" disabled>เลือกปี</option>{yearOptions.map(year=><option key={year} value={year}>{year}</option>)}</select></label></div>:null}
    <TripNoteField value={note} onChange={event=>setNote(event.target.value)}/>
    </div>
  </BottomSheet>{error?<FormErrorDialog title="บันทึกทริปที่เล็งไว้ไม่สำเร็จ" description={error} onClose={()=>setError("")}/>:null}</>;
}

function IdeaCollaboratorsSheet({idea,close,onChanged,confirm,notify}:{idea:TripIdea;close:()=>void;onChanged:()=>void;confirm:(value:Confirmation)=>void;notify:(message:string)=>void}){
  const canManage=idea.access_role==="owner";const [items,setItems]=useState<IdeaCollaborator[]>([]);const [recent,setRecent]=useState<string[]>([]);const [email,setEmail]=useState("");const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{Promise.all([fetch(`/api/trip-ideas/${idea.id}/collaborators`),fetch("/api/collaborators/recent")]).then(async([membersResponse,recentResponse])=>{const members=await readResponse(membersResponse);const contacts=await recentResponse.json();setItems(members);setRecent(Array.isArray(contacts)?contacts.map(contact=>contact.email):[])}).catch(reason=>setError(reason instanceof Error?reason.message:"โหลดผู้ร่วมวางแผนไม่สำเร็จ")).finally(()=>setLoading(false))},[idea.id]);
  async function add(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const added=await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}));setItems(old=>[...old.filter(item=>item.id!==added.id),added]);setRecent(old=>[added.email,...old.filter(value=>value!==added.email)]);setEmail("");onChanged();notify("เพิ่มผู้ร่วมวางแผนแล้ว")}catch(reason){setError((reason as Error).message)}finally{setSaving(false)}}
  async function remove(item:IdeaCollaborator){await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators/${item.id}`,{method:"DELETE"}));setItems(old=>old.filter(row=>row.id!==item.id));onChanged();notify("ลบผู้ร่วมวางแผนแล้ว")}
  const suggestions=recent.filter(value=>!items.some(item=>item.email===value));
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal collaborators-sheet"><div className="modal-head"><div><h2>ผู้ร่วมวางแผน</h2><p>{canManage?"แชร์รายการนี้ให้เพื่อนช่วยดูและแก้ไขข้อมูลร่วมกัน":"รายชื่อผู้ที่วางแผนรายการนี้ร่วมกัน"}</p></div><button type="button" className="icon-btn" onClick={close} aria-label="ปิด"><X size={18}/></button></div>
    {canManage?<form className="collaborator-form" onSubmit={add}><div className="field"><label>อีเมลผู้ร่วมวางแผน</label><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="friend@gmail.com" value={email} onChange={event=>setEmail(event.target.value)} required/></div><button className="primary-btn" disabled={saving}><UserPlus size={16}/>{saving?"กำลังเพิ่ม…":"เพิ่มผู้ร่วมวางแผน"}</button>{suggestions.length?<div className="recent-collaborators"><small>เลือกจากคนที่เพิ่มล่าสุด</small><div>{suggestions.map(value=><button type="button" key={value} onClick={()=>setEmail(value)}>{value}</button>)}</div></div>:null}</form>:null}
    {error?<p className="login-error">{error}</p>:null}<div className="collaborator-list">{loading?<p>กำลังโหลด…</p>:items.length?items.map(item=><div className={`collaborator-row idea-collaborator-row ${canManage?"":"is-readonly"}`} key={item.id}><span className="collaborator-avatar" style={item.avatar_url?{backgroundImage:`url("${item.avatar_url}")`}:undefined}>{!item.avatar_url&&(item.display_name||item.email).charAt(0).toUpperCase()}</span><div className="collaborator-copy"><strong>{item.display_name||item.email}</strong><small>{item.display_name?item.email:item.joined?"เข้าร่วมแล้ว":"แชร์ด้วยอีเมลแล้ว"}</small></div>{canManage?<button type="button" className="delete-record-btn" onClick={()=>confirm({title:`ลบผู้ร่วมวางแผน “${item.email}”?`,description:"บุคคลนี้จะไม่สามารถเปิดหรือแก้ไขรายการนี้ได้อีก",confirmLabel:"ลบผู้ร่วมวางแผน",onConfirm:()=>remove(item)})} aria-label="ลบผู้ร่วมวางแผน"><Trash2 size={17}/></button>:<span className="collaborator-access-badge is-view">ร่วมวางแผน</span>}</div>):<p className="collaborator-empty">ยังไม่มีผู้ร่วมวางแผน</p>}</div>
  </section></div>;
}

export function TripIdeasPage({initialIdeas,demo}:{initialIdeas:TripIdea[];demo:boolean}){
  const router=useRouter();const [ideas,setIdeas]=useState(()=>sortIdeas(initialIdeas));const [editing,setEditing]=useState<IdeaEditor>();const [sharing,setSharing]=useState<TripIdea|null>(null);const [confirmation,setConfirmation]=useState<Confirmation|null>(null);const [busy,setBusy]=useState(false);const [toast,setToast]=useState("");const [query,setQuery]=useState("");const [kindFilter,setKindFilter]=useState<"all"|TripIdeaKind>("all");const [tripType,setTripType]=useState<IdeaTripType>("all");const [selectedYears,setSelectedYears]=useState<string[]>([]);const [filtersOpen,setFiltersOpen]=useState(false);const [draftTripType,setDraftTripType]=useState<IdeaTripType>("all");const [draftYears,setDraftYears]=useState<string[]>([]);const [profile,setProfile]=useState<HeaderProfile|null>(null);const [refreshing,setRefreshing]=useState(false);
  const availableYears=useMemo(()=>[...new Set(ideas.map(idea=>idea.target_year).filter((year):year is number=>typeof year==="number"))].sort((a,b)=>b-a),[ideas]);
  const hasDomestic=ideas.some(idea=>idea.country_code==="TH");
  const hasInternational=ideas.some(idea=>idea.country_code!=="TH");
  const hasActiveTripFilters=tripType!=="all"||selectedYears.length>0;
  const tripTypes=[
    {value:"all" as const,label:"ทั้งหมด",Icon:Luggage},
    ...(hasDomestic?[{value:"domestic" as const,label:"ในประเทศ",Icon:MapPin}]:[]),
    ...(hasInternational?[{value:"international" as const,label:"ต่างประเทศ",Icon:Globe2}]:[]),
  ];
  const searchedIdeas=useMemo(()=>{const keyword=query.trim().toLocaleLowerCase();return ideas.filter(idea=>(!keyword||`${idea.name} ${idea.destination} ${idea.note} ${countryByCode(idea.country_code)?.nameTh||""} ${countryByCode(idea.country_code)?.nameEn||""}`.toLocaleLowerCase().includes(keyword))&&(tripType==="all"||(tripType==="domestic")===(idea.country_code==="TH"))&&(!selectedYears.length||(idea.target_year!==null&&selectedYears.includes(String(idea.target_year)))))},[ideas,query,tripType,selectedYears]);
  const filteredIdeas=kindFilter==="all"?searchedIdeas:searchedIdeas.filter(idea=>idea.kind===kindFilter);
  const plannedIdeas=filteredIdeas.filter(idea=>idea.kind==="planned");
  const somedayIdeas=filteredIdeas.filter(idea=>idea.kind==="someday");
  const kindFilters:TripFilterOption<"all"|TripIdeaKind>[]=[
    {value:"all",label:"ทั้งหมด",Icon:Luggage,count:searchedIdeas.length,tone:"all"},
    {value:"planned",label:"ทริปที่เล็งไว้",Icon:CalendarRange,count:searchedIdeas.filter(idea=>idea.kind==="planned").length,tone:"upcoming"},
    {value:"someday",label:"ลิสต์สักวันหนึ่ง",Icon:Compass,count:searchedIdeas.filter(idea=>idea.kind==="someday").length,tone:"past"},
  ];
  useEffect(()=>{let active=true;getCurrentAccount().then(account=>{if(active)setProfile(account)}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{
    if(sessionStorage.getItem("invitation:accepted:trip_idea")!=="1")return;
    const controller=new AbortController();
    void (async()=>{
      const fresh=await readResponse(await fetch("/api/trip-ideas",{cache:"no-store",signal:controller.signal})) as TripIdea[];
      if(controller.signal.aborted)return;
      setIdeas(sortIdeas(fresh));
      sessionStorage.removeItem("invitation:accepted:trip_idea");
    })().catch(()=>{});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{const root=document.documentElement;const sheetOpen=Boolean(editing||sharing);root.classList.toggle("sheet-open",sheetOpen);root.classList.toggle("confirm-open",Boolean(confirmation));return()=>root.classList.remove("sheet-open","confirm-open")},[editing,sharing,confirmation]);
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),2400)}
  function openFilters(){setDraftTripType(tripType);setDraftYears([...selectedYears]);setFiltersOpen(true)}
  function openForm(idea:TripIdea|null,promote=false){if(demo){notify("เข้าสู่ระบบเพื่อเพิ่มหรือแก้ไขรายการ");return}setEditing({idea,promote})}
  async function save(draft:IdeaDraft){setBusy(true);try{const current=editing?.idea||null;const saved=await readResponse(await fetch(current?`/api/trip-ideas/${current.id}`:"/api/trip-ideas",{method:current?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)})) as TripIdea;setIdeas(items=>sortIdeas(current?items.map(item=>item.id===saved.id?saved:item):[...items,saved]));setEditing(undefined);notify(current?"บันทึกทริปที่เล็งไว้แล้ว":"เพิ่มทริปที่เล็งไว้แล้ว")}finally{setBusy(false)}}
  async function remove(idea:TripIdea){await readResponse(await fetch(`/api/trip-ideas/${idea.id}`,{method:"DELETE"}));setIdeas(items=>items.filter(item=>item.id!==idea.id));setEditing(undefined);notify("ลบออกจากลิสต์แล้ว")}
  async function leave(idea:TripIdea){await readResponse(await fetch(`/api/trip-ideas/${idea.id}`,{method:"DELETE"}));setIdeas(items=>items.filter(item=>item.id!==idea.id));setEditing(undefined);notify("ออกจากทริปที่เล็งไว้แล้ว")}
  function askRemove(idea:TripIdea){
    if(idea.access_role==="collaborator"){
      setConfirmation({title:`ออกจาก “${idea.name}”?`,description:"เมื่อออกแล้ว ทริปที่เล็งไว้นี้จะหายจากรายการของคุณ และคุณจะไม่สามารถเปิดหรือแก้ไขร่วมกันได้อีก",confirmLabel:"ออกจากทริปที่เล็งไว้",busyLabel:"กำลังออก…",onConfirm:()=>leave(idea)});
      return;
    }
    setConfirmation({title:`ลบ “${idea.name}” ออกจากลิสต์?`,description:"รายการ รูปปก และการแชร์กับผู้ร่วมวางแผนจะถูกลบถาวร",confirmLabel:"ลบรายการ",onConfirm:()=>remove(idea)});
  }
  async function refreshIdea(id:string){try{const fresh=await readResponse(await fetch(`/api/trip-ideas/${id}`,{cache:"no-store"})) as TripIdea;setIdeas(items=>items.map(item=>item.id===id?fresh:item));setSharing(current=>current?.id===id?fresh:current)}catch{}}
  async function refreshAll(){if(refreshing)return;setRefreshing(true);try{const fresh=await readResponse(await fetch("/api/trip-ideas",{cache:"no-store"})) as TripIdea[];setIdeas(sortIdeas(fresh));window.dispatchEvent(new Event("invitation-notifications:refresh"));notify("อัปเดตทริปที่เล็งไว้แล้ว")}catch(error){notify(error instanceof Error?error.message:"อัปเดตไม่สำเร็จ")}finally{setRefreshing(false)}}
  async function invitationChanged(result:Pick<InvitationNotification,"invitation_type">){
    router.refresh();
    if(result.invitation_type!=="trip_idea"){notify("ตอบรับคำเชิญทริปแล้ว");return}
    const fresh=await readResponse(await fetch("/api/trip-ideas",{cache:"no-store"})) as TripIdea[];
    setIdeas(sortIdeas(fresh));
    sessionStorage.removeItem("invitation:accepted:trip_idea");
    notify("เพิ่มทริปที่เล็งไว้จากคำเชิญแล้ว");
  }
  function convertToTrip(idea:TripIdea){if(demo){notify("เข้าสู่ระบบเพื่อสร้างทริปจริง");return}router.push(`/?tripIdea=${encodeURIComponent(idea.id)}`)}
  const avatarLabel=(profile?.display_name||profile?.email||"?").trim();
  return <div className="app-shell flow-shell trip-ideas-page-shell">
    {toast?<div className="toast toast-success" role="status"><CheckCircle2 size={17}/>{toast}</div>:null}
    <main>
      <header className="mobile-head flow-header"><Link className="brand" href="/" aria-label="RouteRao · หน้าแรก"><Image src="/routerao-logo-transparent-512.png" alt="RouteRao" width={48} height={48} priority unoptimized/><div>RouteRao<small>travel smarter together</small></div></Link><nav className="mobile-actions" aria-label="เมนูหลัก"><button className="icon-btn home-refresh-btn" type="button" onClick={()=>void refreshAll()} disabled={refreshing} aria-label="รีเฟรช" title="รีเฟรช"><RefreshCw className={refreshing?"analytics-refresh-spinning":""} size={24}/></button><InvitationNotifications onChanged={invitationChanged}/><button className="home-profile-btn" type="button" onClick={()=>router.push("/settings")} aria-label="โปรไฟล์" title="โปรไฟล์"><span className="account-avatar account-avatar-small"><span className="account-avatar-image" style={profile?.avatar_url?{backgroundImage:`url("${profile.avatar_url}")`}:undefined}>{!profile?.avatar_url&&avatarLabel.charAt(0).toUpperCase()}</span></span></button></nav></header>
      <div className="trip-ideas-screen">
        <PageIntro title="ทริปที่เล็งไว้" titleIcon={<Heart size={25} fill="currentColor"/>} subtitle={<>เก็บแพลนที่อยากไปไว้ที่นี่ แล้วออกเดินทางด้วยกัน</>}/>
        <div className="trip-ideas-search-row"><label className="trip-search trip-ideas-search"><Search size={20}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นหาทริป เมือง หรือประเทศ" aria-label="ค้นหาทริป เมือง หรือประเทศ"/>{query?<button type="button" onClick={()=>setQuery("")} aria-label="ล้างคำค้นหา"><X size={15}/></button>:null}</label><button className={`trip-directory-filter-toggle ${filtersOpen||hasActiveTripFilters?"active":""}`} type="button" onClick={openFilters} aria-expanded={filtersOpen} aria-label="ตั้งค่าตัวกรอง" title="ตั้งค่าตัวกรอง"><Settings2 size={21}/>{hasActiveTripFilters?<i className="notification-dot trip-directory-filter-dot" aria-label="กำลังใช้ตัวกรอง"/>:null}</button><button className="trip-ideas-add-button" type="button" onClick={()=>openForm(null)} aria-label="เพิ่มทริปที่เล็งไว้" title="เพิ่มทริปที่เล็งไว้"><Plus size={21}/></button></div>
        {filtersOpen?<BottomSheet
          title="เลือกตัวกรองทริป"
          subtitle="เลือกประเภทและปีที่ต้องการได้มากกว่า 1 ปี แล้วกดยืนยันเพื่อแสดงผล"
          closeLabel="ยกเลิก"
          onClose={()=>setFiltersOpen(false)}
          onSubmit={event=>{event.preventDefault();setTripType(draftTripType);setSelectedYears([...draftYears].sort((a,b)=>Number(b)-Number(a)));setFiltersOpen(false)}}
          className="trip-directory-filter-sheet"
          bodyClassName="bottom-sheet-body trip-directory-filter-body"
          submitLabel="แสดงผล"
          deleteLabel="รีเซ็ตตัวกรอง"
          deleteIcon={<RotateCcw size={18}/>}
          onDelete={()=>{setDraftTripType("all");setDraftYears([]);setTripType("all");setSelectedYears([]);setFiltersOpen(false)}}
        >
          <section className="trip-directory-filter-section">
            <h3>ประเภททริป</h3>
            <div className="trip-type-options status-filter trip-directory-type-options trip-idea-trip-type-options" role="group" aria-label="ประเภททริป">
              {tripTypes.map(({value,label,Icon})=><button type="button" key={value} className={`${draftTripType===value?"active":""} status-${value}`} onClick={()=>setDraftTripType(value)} aria-pressed={draftTripType===value}><Icon size={24}/><span><strong>{label}</strong></span></button>)}
            </div>
          </section>
          {availableYears.length?<section className="trip-directory-filter-section">
            <h3>ปีที่เดินทาง</h3>
            <div className="year-filter" role="group" aria-label="ปีที่เดินทาง">
              <button type="button" className={!draftYears.length?"active":""} onClick={()=>setDraftYears([])} aria-pressed={!draftYears.length}>ทุกปี</button>
              {availableYears.map(year=>{const value=String(year);const active=draftYears.includes(value);return <button type="button" key={year} className={active?"active":""} onClick={()=>setDraftYears(current=>active?current.filter(item=>item!==value):[...current,value])} aria-pressed={active}>{year}</button>})}
            </div>
          </section>:null}
        </BottomSheet>:null}
        <TripSegmentedFilter value={kindFilter} options={kindFilters} onChange={setKindFilter} ariaLabel="กรองทริปที่เล็งไว้" tripLabel="ทริป" className="trip-ideas-type-filter"/>
        <section className="trip-ideas-list" aria-label="รายการทริปที่เล็งไว้">
          {filteredIdeas.length?<div className="trip-idea-groups">
            {plannedIdeas.length?<section className="trip-ideas-group" aria-label="ทริปที่เล็งไว้"><div className="trip-ideas-grid">{plannedIdeas.map(idea=><IdeaCard key={idea.id} idea={idea} edit={()=>openForm(idea)} convert={()=>convertToTrip(idea)} share={()=>setSharing(idea)}/>)}</div></section>:null}
            {somedayIdeas.length?<section className="trip-ideas-group" aria-label="ลิสต์สักวันหนึ่ง">{kindFilter==="all"?<div className="trip-ideas-divider"><span/><h2>ลิสต์สักวันหนึ่ง</h2><span/></div>:null}<div className="trip-ideas-grid">{somedayIdeas.map(idea=><IdeaCard key={idea.id} idea={idea} edit={()=>openForm(idea)} share={()=>setSharing(idea)}/>)}</div></section>:null}
          </div>:<div className="trip-ideas-empty"><Search size={25}/><strong>{hasActiveTripFilters?"ไม่พบทริปที่ตรงกับตัวกรอง":query?"ไม่พบทริปที่ค้นหา":kindFilter!=="all"?"ยังไม่มีทริปในหมวดนี้":"ยังไม่มีทริปที่เล็งไว้"}</strong><span>{hasActiveTripFilters?"ลองเปลี่ยนประเภททริปหรือปีที่เลือก":query?"ลองค้นหาด้วยชื่อเมืองหรือประเทศอื่น":kindFilter!=="all"?"ลองเลือกหมวดอื่น หรือเพิ่มทริปใหม่":"เพิ่มสถานที่ที่อยากไปเก็บไว้ก่อนได้"}</span></div>}
        </section>
      </div>
    </main>
    {editing?<IdeaForm key={`${editing.idea?.id||"new"}:${editing.promote}`} editor={editing} close={()=>setEditing(undefined)} save={save} requestDelete={()=>editing.idea&&askRemove(editing.idea)} busy={busy}/>:null}
    {sharing?<IdeaCollaboratorsSheet key={sharing.id} idea={sharing} close={()=>setSharing(null)} onChanged={()=>void refreshIdea(sharing.id)} confirm={setConfirmation} notify={notify}/>:null}
    {confirmation?<ConfirmDialog confirmation={confirmation} close={()=>setConfirmation(null)}/>:null}
  </div>;
}
