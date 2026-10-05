"use client";
import { tripAvatarOrder } from "@/src/lib/trip-avatar-order";
import { ParticipantMode, TripCompanions } from "./trip-companions";
import { ParticipantAccess, ParticipantInviteActions } from "./participant-access";
import { isValidInvitationEmail } from "@/src/lib/invitation-email";
import { UserRound } from "lucide-react";
import { TripNameInput } from "@/src/components/trip-name-input";
import Image from "next/image";
import { tripCovers, uploadTripCovers, type CoverDraft } from "@/src/lib/trip-covers";
import { TripCoverArt } from "./trip-cover-gallery";
import { FetchSkeleton } from "@/src/components/fetch-skeleton";
import { CollaboratorsSkeleton } from "@/src/components/collaborators-skeleton";

import { useEffect,useMemo,useState,type FormEvent,type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays,CalendarRange,CheckCircle2,Compass,Globe2,Heart,LogOut,Luggage,MapPin,PlaneTakeoff,Plus,RefreshCw,RotateCcw,Search,Settings2,Trash2,UserPlus,X } from "lucide-react";
import type { TripIdea,TripIdeaKind,TripIdeaMember } from "@/src/lib/trip-ideas";
import { countryByCode,isDomesticTrip,TRIP_COUNTRIES } from "@/src/lib/countries";
import { TRIP_DESTINATION_OPTIONS,type TripDestinationOption } from "@/src/lib/travel-badges";
import { ConfirmDialog,EmptyState,TripDestinationLines,TripCountryPicker,TripCoverPicker,TripDestinationPicker,type Confirmation } from "@/src/components/bn-trip-app";
import { PageIntro } from "@/src/components/page-intro";
import { NavIcon } from "@/src/components/nav-icon";
import { BottomSheet } from "@/src/components/bottom-sheet";
import { InvitationNotifications,type InvitationNotification } from "@/src/components/invitation-notifications";
import { FormErrorDialog } from "@/src/components/form-error-dialog";
import { TripNoteField } from "@/src/components/trip-note-field";
import { ideaCountdown, ideaTargetDate } from "@/src/lib/trip-idea-display";
import { TripSegmentedFilter, type TripFilterOption } from "@/src/components/trip-segmented-filter";
import { TripCountdownBadge } from "@/src/components/trip-countdown-badge";
import { TripFavoriteButton } from "@/src/components/trip-favorite-button";
import { tripMatchesSearch } from "@/src/lib/destination-search";
import { TripMemberFilter } from "@/src/components/trip-member-filter";
import { collectFilterMembers, matchesMemberFilter } from "@/src/lib/trip-member-filter";

type IdeaDraft={name:string;countryCode:string;countryCodes:string[];locationIds:string[];kind:TripIdeaKind;targetMonth:number|null;targetYear:number|null;note:string;coverImageUrl:string;coverImageUrls:string[]};
type IdeaEditor={idea:TripIdea|null;promote:boolean};
type IdeaCollaborator={id:string;email:string;user_id:string|null;joined:boolean;display_name:string|null;avatar_url:string|null;access_level:"view"|"admin"};
type IdeaTripType="all"|"domestic"|"international";
const monthNames=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function timestamp(value:string){const parsed=Date.parse(value);return Number.isNaN(parsed)?0:parsed}
function sortIdeas(items:TripIdea[]){return [...items].sort((a,b)=>a.kind!==b.kind?(a.kind==="planned"?-1:1):a.kind==="planned"?((a.target_year||9999)-(b.target_year||9999)||(a.target_month||99)-(b.target_month||99)):timestamp(b.created_at)-timestamp(a.created_at))}
async function readResponse(response:Response){const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");return data}
function stop(event:{stopPropagation:()=>void}){event.stopPropagation()}
function IdeaAvatars({members:accounts,companions=[],open}:{members:TripIdeaMember[];companions?:{id:string;name:string}[];open:()=>void}){
  const members:TripIdeaMember[]=[...accounts,...companions.map(person=>({id:`guest:${person.id}`,display_name:person.name,email:"",avatar_url:null,role:"collaborator" as const}))];
  const {visible,hidden}=tripAvatarOrder(members);
  return <button type="button" className="trip-idea-avatars" onClick={event=>{stop(event);open()}} aria-label={`ผู้ร่วมวางแผน ${members.length} คน`} title="ผู้ร่วมวางแผน">
    {hidden>0?<span className="is-more">+{hidden}</span>:null}
    {visible.map(member=><span key={member.id} data-person-kind={member.role==="owner"?"owner":member.id.startsWith("guest:")?"guest":"email"} className={member.role==="owner"?"is-owner":""} style={member.avatar_url?{backgroundImage:`url("${member.avatar_url}")`}:undefined} title={member.display_name||member.email}>{!member.avatar_url&&(member.id.startsWith("guest:")?<UserRound size={18}/>:(member.display_name||member.email||"?").charAt(0).toUpperCase())}</span>)}
  </button>;
}

function IdeaCard({idea,edit,convert,share,toggleFavorite,favoriteBusy}:{idea:TripIdea;edit:()=>void;convert?:()=>void;share:()=>void;toggleFavorite:()=>void;favoriteBusy:boolean}){
  const detail=(idea.note||"").trim();
  const countdown=ideaCountdown(idea);
  const targetDate=ideaTargetDate(idea);
  const activate=(event:KeyboardEvent<HTMLElement>)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();edit()}};
  return <article className={`compact-trip-card trip-idea-card is-${idea.kind} ${idea.members?.length>1?"has-shared-members":""}`} role="button" tabIndex={0} onClick={edit} onKeyDown={activate} aria-label={`แก้ไข ${idea.name}`}>
    <div className="compact-trip-cover"><TripCoverArt record={idea} sizes="(max-width: 639px) 42vw, 260px"/>{countdown?<TripCountdownBadge label={countdown}/>:null}<TripFavoriteButton favorite={Boolean(idea.is_favorite)} onToggle={toggleFavorite} disabled={favoriteBusy}/></div>
    <div className="compact-trip-body trip-idea-copy"><h3>{idea.name}</h3>
      <p><TripDestinationLines trip={idea}/></p>
      {targetDate?<small className="trip-idea-target-date"><CalendarDays size={11}/><span>{targetDate}</span></small>:null}
      {detail?<small className="trip-idea-note">{detail}</small>:null}
      <div className="trip-idea-card-footer">
        <IdeaAvatars members={idea.members||[]} companions={idea.companions} open={share}/>
        <div className="trip-idea-footer-actions">
          {idea.kind==="planned"&&convert&&idea.access_level!=="view"?<button className="trip-idea-convert" type="button" aria-label="สร้างทริป" title="สร้างทริป" onClick={event=>{stop(event);convert()}}><PlaneTakeoff size={16} aria-hidden="true"/></button>:null}
          {(idea.access_role === "owner"||idea.access_level === "admin") && <button className="trip-idea-invite" type="button" onClick={event=>{stop(event);share()}} aria-label="เชิญเพื่อนร่วมวางแผน" title="เชิญเพื่อนร่วมวางแผน"><UserPlus size={16}/></button>}
        </div>
      </div>
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
  const [countryCodes,setCountryCodes]=useState(()=>[...new Set([initialCountry.code,...(current?.trip_destinations||[]).map(item=>item.countryCode)])]);const countryCode=countryCodes[0];
  const [locations,setLocations]=useState<TripDestinationOption[]>(()=>current?.trip_destinations?.map(saved=>{
    const option=TRIP_DESTINATION_OPTIONS.find(candidate=>candidate.id===saved.id);
    return option||{...saved,searchTerms:[saved.nameTh,saved.nameEn].filter(Boolean)} as TripDestinationOption;
  })||[]);
  const [kind,setKind]=useState<TripIdeaKind>(promote?"planned":current?.kind||"planned");
  const [targetMonth,setTargetMonth]=useState<number|null>(current?current.target_month:promote?null:new Date().getMonth()+1);
  const [targetYear,setTargetYear]=useState<number|null>(current?current.target_year:promote?null:defaultYear);
  const [note,setNote]=useState(current?.note||"");const [covers,setCovers]=useState<CoverDraft[]>(()=>current?tripCovers(current).filter(url=>url!=="/travel-postcard-fallback.jpg"):[]);const [coversChanged,setCoversChanged]=useState(false);const [error,setError]=useState("");
  const validationIncomplete=!name.trim()||!locations.length||(kind==="planned"&&(!targetMonth||!targetYear));
  const locationIds=locations.map(location=>location.id).sort();
  const originalLocationIds=(current?.trip_destinations||[]).map(location=>location.id).sort();
  const unchanged=Boolean(current)&&!coversChanged&&name.trim()===(current?.name||"").trim()&&countryCode===(current?.country_code||initialCountry.code)&&locationIds.join("|")===originalLocationIds.join("|")&&kind===current?.kind&&targetMonth===(current?.target_month||null)&&targetYear===(current?.target_year||null)&&note.trim()===(current?.note||"").trim();
  async function submit(event:FormEvent){event.preventDefault();setError("");try{if(!locations.length)throw new Error("กรุณาเลือกเมืองหรือจังหวัดอย่างน้อย 1 แห่ง");const missing=countryCodes.find(code=>!locations.some(place=>place.countryCode===code));if(missing)throw new Error(`กรุณาเลือกเมืองใน${countryByCode(missing)?.nameTh}อย่างน้อย 1 แห่ง หรือเอาประเทศนี้ออก`);const coverImageUrls=await uploadTripCovers(covers);const coverImageUrl=coverImageUrls[0];await save({name,countryCode,countryCodes,locationIds:locations.map(location=>location.id),kind,targetMonth,targetYear,note,coverImageUrl,coverImageUrls})}catch(caught){setError((caught as Error).message)}}
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
    <TripCoverPicker value={covers} onChange={value=>{setCovers(value);setCoversChanged(true)}}/>
    <label className="trip-idea-field"><span>ชื่อทริป</span><TripNameInput value={name} onChange={setName} placeholder="เช่น Fukuoka Food Trip"/></label>
    <TripCountryPicker selected={countryCodes} onChange={codes=>{setCountryCodes(codes);setLocations(current=>current.filter(item=>codes.includes(item.countryCode)))}}/>
    <TripDestinationPicker countryCode={countryCode} countryCodes={countryCodes} selected={locations} onChange={setLocations}/>
    <fieldset className="trip-idea-kind-picker"><legend>วางไว้ในลิสต์ไหน</legend><button type="button" className={kind==="planned"?"active":""} onClick={()=>{setKind("planned");setTargetMonth(targetMonth||1);setTargetYear(targetYear||defaultYear)}}><CalendarRange size={17}/><span>ทริปที่เล็งไว้<small>มีเดือนและปีคร่าว ๆ</small></span></button><button type="button" className={kind==="someday"?"active":""} onClick={()=>setKind("someday")}><Compass size={17}/><span>ลิสต์สักวันหนึ่ง<small>ยังไม่รู้ว่าจะไปเมื่อไร</small></span></button></fieldset>
    <div className={`trip-idea-date-row${kind==="someday"?" is-disabled":""}`}><label className="trip-idea-field"><span>เดือน</span><select required={kind==="planned"} disabled={kind==="someday"} value={targetMonth||""} onChange={event=>setTargetMonth(event.target.value?Number(event.target.value):null)}><option value="" disabled>เลือกเดือน</option>{monthNames.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><label className="trip-idea-field"><span>ปี ค.ศ.</span><select required={kind==="planned"} disabled={kind==="someday"} value={targetYear||""} onChange={event=>setTargetYear(event.target.value?Number(event.target.value):null)}><option value="" disabled>เลือกปี</option>{yearOptions.map(year=><option key={year} value={year}>{year}</option>)}</select></label></div>
    <TripNoteField value={note} onChange={event=>setNote(event.target.value)}/>
    </div>
  </BottomSheet>{error?<FormErrorDialog title="บันทึกทริปที่เล็งไว้ไม่สำเร็จ" description={error} onClose={()=>setError("")}/>:null}</>;
}

function IdeaCollaboratorsSheet({idea,close,onChanged,confirm,notify}:{idea:TripIdea;close:()=>void;onChanged:()=>void;confirm:(value:Confirmation)=>void;notify:(message:string)=>void}){
  const [participantMode,setParticipantMode]=useState<"email"|"name">("email");
  const [inviteAccess,setInviteAccess]=useState<"view"|"admin">(idea.access_role==="owner"?"admin":"view");
  const canInvite=idea.access_role==="owner"||idea.access_level==="admin";
  const canManage=idea.access_role==="owner";const [items,setItems]=useState<IdeaCollaborator[]>([]);const [recent,setRecent]=useState<string[]>([]);const [email,setEmail]=useState("");const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{Promise.all([fetch(`/api/trip-ideas/${idea.id}/collaborators`),fetch("/api/collaborators/recent")]).then(async([membersResponse,recentResponse])=>{const members=await readResponse(membersResponse);const contacts=await recentResponse.json();setItems(members);setRecent(Array.isArray(contacts)?contacts.map(contact=>contact.email):[])}).catch(reason=>setError(reason instanceof Error?reason.message:"โหลดผู้ร่วมวางแผนไม่สำเร็จ")).finally(()=>setLoading(false))},[idea.id]);
  async function add(event:FormEvent){event.preventDefault();if(saving||!isValidInvitationEmail(email))return;setSaving(true);setError("");try{const added=await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,accessLevel:inviteAccess})}));setItems(old=>[...old.filter(item=>item.id!==added.id),added]);setRecent(old=>[added.email,...old.filter(value=>value!==added.email)]);setEmail("");onChanged();notify("ส่งคำเชิญแล้ว")}catch(reason){setError((reason as Error).message)}finally{setSaving(false)}}
  async function updateAccess(item:IdeaCollaborator,accessLevel:"view"|"admin"){
    setSaving(true);setError("");try{await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessLevel})}));setItems(current=>current.map(person=>person.id===item.id?{...person,access_level:accessLevel}:person));onChanged();notify("อัปเดตสิทธิ์แล้ว")}catch(reason){setError((reason as Error).message)}finally{setSaving(false)}
  }
  async function remove(item:IdeaCollaborator){await readResponse(await fetch(`/api/trip-ideas/${idea.id}/collaborators/${item.id}`,{method:"DELETE"}));setItems(old=>old.filter(row=>row.id!==item.id));onChanged();notify("ลบผู้ร่วมวางแผนแล้ว")}
  const suggestions=recent.filter(value=>!items.some(item=>item.email===value));
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}><section className="modal collaborators-sheet"><div className="modal-head"><div><h2>ผู้ร่วมวางแผน</h2><p>{canManage?"แชร์รายการนี้ให้เพื่อนช่วยดูและแก้ไขข้อมูลร่วมกัน":"รายชื่อผู้ที่วางแผนรายการนี้ร่วมกัน"}</p></div><button type="button" className="icon-btn" onClick={close} aria-label="ปิด"><X size={18}/></button></div>
    {canInvite&&<ParticipantMode value={participantMode} onChange={setParticipantMode}/>}
    <TripCompanions id={idea.id} idea editable={canInvite} showForm={participantMode==="name"} onChanged={onChanged}/>
    {canInvite&&participantMode==="email"?<form className="collaborator-form" onSubmit={add}><div className="field"><label>อีเมลผู้ร่วมวางแผน</label><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" placeholder="friend@gmail.com" value={email} onChange={event=>setEmail(event.target.value)} required/></div><ParticipantInviteActions value={inviteAccess} onChange={setInviteAccess} allowAdmin={canManage} busy={saving} disabled={!isValidInvitationEmail(email)}/>{suggestions.length?<div className="recent-collaborators"><small>เลือกจากคนที่เพิ่มล่าสุด</small><div>{suggestions.map(value=><button type="button" key={value} onClick={()=>setEmail(value)}>{value}</button>)}</div></div>:null}</form>:null}
    {error?<p className="login-error">{error}</p>:null}<div className="collaborator-list">{loading?<CollaboratorsSkeleton count={idea.collaborator_count ?? idea.members.filter(member=>member.role!=="owner").length} label="กำลังโหลดผู้ร่วมวางแผน" />:items.length?items.map(item=><div className={`collaborator-row idea-collaborator-row ${canManage?"":"is-readonly"}`} key={item.id}><span className="collaborator-avatar" style={item.avatar_url?{backgroundImage:`url("${item.avatar_url}")`}:undefined}>{!item.avatar_url&&(item.display_name||item.email).charAt(0).toUpperCase()}</span><div className="collaborator-copy"><strong>{item.display_name||item.email}</strong><small>{item.display_name?item.email:item.joined?"เข้าร่วมแล้ว":"แชร์ด้วยอีเมลแล้ว"}</small></div>{canManage&&<ParticipantAccess label={`สิทธิ์ ${item.email}`} disabled={saving} value={item.access_level} onChange={access=>void updateAccess(item,access)}/>}{canManage?<button type="button" className="delete-record-btn" onClick={()=>confirm({title:`ลบผู้ร่วมวางแผน “${item.email}”?`,description:"บุคคลนี้จะไม่สามารถเปิดหรือแก้ไขรายการนี้ได้อีก",confirmLabel:"ลบผู้ร่วมวางแผน",onConfirm:()=>remove(item)})} aria-label="ลบผู้ร่วมวางแผน"><Trash2 size={17}/></button>:<span className="collaborator-access-badge is-view">{item.access_level==="admin"?"Admin":"View"}</span>}</div>):<p className="collaborator-empty">ยังไม่ได้เชิญผู้ร่วมทริปด้วยอีเมล</p>}</div>
  </section></div>;
}

export function TripIdeasPage({initialIdeas,initialEditId,demo,currentUserId}:{initialIdeas:TripIdea[];initialEditId?:string;demo:boolean;currentUserId:string}){
  const [selectedMembers,setSelectedMembers]=useState<string[]>([]);
  const [draftMembers,setDraftMembers]=useState<string[]>([]);
  const [favoriteBusyId,setFavoriteBusyId]=useState<string|null>(null);
  const router=useRouter();const [ideas,setIdeas]=useState(()=>sortIdeas(initialIdeas));const [editing,setEditing]=useState<IdeaEditor|undefined>(()=>{const idea=initialIdeas.find(item=>item.id===initialEditId);return idea?{idea,promote:false}:undefined});const [sharing,setSharing]=useState<TripIdea|null>(null);const [confirmation,setConfirmation]=useState<Confirmation|null>(null);const [busy,setBusy]=useState(false);const [toast,setToast]=useState("");const [query,setQuery]=useState("");const [kindFilter,setKindFilter]=useState<"all"|TripIdeaKind|"favorite">("all");const [tripType,setTripType]=useState<IdeaTripType>("all");const [selectedYears,setSelectedYears]=useState<string[]>([]);const [filtersOpen,setFiltersOpen]=useState(false);const [draftTripType,setDraftTripType]=useState<IdeaTripType>("all");const [draftYears,setDraftYears]=useState<string[]>([]);const [refreshing,setRefreshing]=useState(false);
  const availableYears=useMemo(()=>[...new Set(ideas.filter(idea=>idea.kind==="planned").map(idea=>idea.target_year).filter((year):year is number=>typeof year==="number"))].sort((a,b)=>b-a),[ideas]);
  const hasDomestic=ideas.some(idea=>isDomesticTrip(idea));
  const hasInternational=ideas.some(idea=>!isDomesticTrip(idea));
  const filterMembers=useMemo(()=>collectFilterMembers(ideas,currentUserId),[ideas,currentUserId]);
  const hasActiveTripFilters=tripType!=="all"||selectedYears.length>0||selectedMembers.length>0;
  const tripTypes=[
    {value:"all" as const,label:"ทั้งหมด",Icon:Luggage},
    ...(hasDomestic?[{value:"domestic" as const,label:"ในประเทศ",Icon:MapPin}]:[]),
    ...(hasInternational?[{value:"international" as const,label:"ต่างประเทศ",Icon:Globe2}]:[]),
  ];
  const searchedIdeas=useMemo(()=>ideas.filter(idea=>matchesMemberFilter(idea.members,selectedMembers)&&tripMatchesSearch(idea,query)&&(tripType==="all"||(tripType==="domestic")===(isDomesticTrip(idea)))&&(!selectedYears.length||(idea.kind==="planned"&&idea.target_year!==null&&selectedYears.includes(String(idea.target_year))))),[ideas,query,tripType,selectedYears,selectedMembers]);
  const filteredIdeas=kindFilter==="all"?searchedIdeas:searchedIdeas.filter(idea=>kindFilter==="favorite"?idea.is_favorite:idea.kind===kindFilter);
  const plannedIdeas=filteredIdeas.filter(idea=>idea.kind==="planned");
  const somedayIdeas=filteredIdeas.filter(idea=>idea.kind==="someday");
  const kindFilters:TripFilterOption<"all"|TripIdeaKind|"favorite">[]=[
    {value:"all",label:"ทั้งหมด",Icon:Luggage,count:searchedIdeas.length,tone:"all"},
    {value:"planned",label:"เล็งไว้",Icon:CalendarRange,count:searchedIdeas.filter(idea=>idea.kind==="planned").length,tone:"upcoming"},
    {value:"someday",label:"สักวัน",Icon:Compass,count:searchedIdeas.filter(idea=>idea.kind==="someday").length,tone:"past"},
    {value:"favorite",label:"ติดดาว",Icon:Heart,count:searchedIdeas.filter(idea=>idea.is_favorite).length,tone:"favorite"},
  ];
  useEffect(()=>{
    if(!initialEditId)return;
    const url=new URL(window.location.href);
    if(url.searchParams.get("edit")!==initialEditId)return;
    url.searchParams.delete("edit");
    window.history.replaceState(window.history.state,"",`${url.pathname}${url.search}${url.hash}`);
  },[initialEditId]);
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
  function openFilters(){setDraftTripType(tripType);setDraftYears([...selectedYears]);setDraftMembers([...selectedMembers]);setFiltersOpen(true)}
  function openForm(idea:TripIdea|null,promote=false){if(demo){notify("เข้าสู่ระบบเพื่อเพิ่มหรือแก้ไขรายการ");return}setEditing({idea,promote})}
  async function toggleFavorite(idea:TripIdea){
    if(favoriteBusyId)return;
    const favorite=!idea.is_favorite;
    setFavoriteBusyId(idea.id);
    setIdeas(items=>items.map(item=>item.id===idea.id?{...item,is_favorite:favorite}:item));
    try{
      await readResponse(await fetch(`/api/trip-ideas/${idea.id}/favorite`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({favorite})}));
      sessionStorage.setItem("bn-trip-favorites-changed","1");
      notify(favorite?"เพิ่มทริปในรายการโปรดแล้ว":"นำทริปออกจากรายการโปรดแล้ว");
    }catch(error){
      setIdeas(items=>items.map(item=>item.id===idea.id?{...item,is_favorite:Boolean(idea.is_favorite)}:item));
      notify(error instanceof Error?error.message:"บันทึกรายการโปรดไม่สำเร็จ");
    }finally{setFavoriteBusyId(null)}
  }
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
  return <div className="app-shell flow-shell trip-ideas-page-shell">
    {toast&&typeof document!=="undefined"?createPortal(<div className="toast toast-success" role="status" aria-live="polite"><CheckCircle2 size={17}/>{toast}</div>,document.body):null}
    <main>
      <header className="mobile-head flow-header"><Link className="brand" href="/" aria-label="RouteRao · หน้าแรก"><Image src="/routerao-logo-transparent-512.png" alt="RouteRao" width={48} height={48} priority unoptimized/><div>RouteRao<small>travel smarter together</small></div></Link><nav className="mobile-actions" aria-label="เมนูหลัก"><button className="icon-btn home-refresh-btn" type="button" onClick={()=>void refreshAll()} disabled={refreshing} aria-label="รีเฟรช" title="รีเฟรช"><RefreshCw className={refreshing?"analytics-refresh-spinning":""} size={24}/></button><InvitationNotifications onChanged={invitationChanged}/></nav></header>
      <div className="trip-ideas-screen">
        <PageIntro title="ทริปที่เล็งไว้" titleIcon={<NavIcon name="radar" filled width={25} height={25} aria-hidden="true" />} subtitle={<>เก็บแพลนที่อยากไปไว้ที่นี่ แล้วออกเดินทางด้วยกัน</>}/>
        <div className="trip-ideas-search-row"><label className="trip-search trip-ideas-search"><Search size={20}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ค้นหาทริป เมือง หรือประเทศ" aria-label="ค้นหาทริป เมือง หรือประเทศ"/>{query?<button type="button" onClick={()=>setQuery("")} aria-label="ล้างคำค้นหา"><X size={15}/></button>:null}</label><button className={`trip-directory-filter-toggle ${filtersOpen||hasActiveTripFilters?"active":""}`} type="button" onClick={openFilters} aria-expanded={filtersOpen} aria-label="ตั้งค่าตัวกรอง" title="ตั้งค่าตัวกรอง"><Settings2 size={21}/>{hasActiveTripFilters?<i className="notification-dot trip-directory-filter-dot" aria-label="กำลังใช้ตัวกรอง"/>:null}</button><button className="trip-ideas-add-button" type="button" onClick={()=>openForm(null)} aria-label="เพิ่มทริปที่เล็งไว้" title="เพิ่มทริปที่เล็งไว้"><Plus size={21}/></button></div>
        {filtersOpen?<BottomSheet
          title="เลือกตัวกรองทริป"
          subtitle="เลือกปีและผู้ร่วมทริปได้หลายคน แล้วกดแสดงผล"
          closeLabel="ยกเลิก"
          onClose={()=>setFiltersOpen(false)}
          onSubmit={event=>{event.preventDefault();setTripType(draftTripType);setSelectedYears([...draftYears].sort((a,b)=>Number(b)-Number(a)));setSelectedMembers([...draftMembers]);setFiltersOpen(false)}}
          className="trip-directory-filter-sheet"
          bodyClassName="bottom-sheet-body trip-directory-filter-body"
          submitLabel="แสดงผล"
          deleteLabel="รีเซ็ตตัวกรอง"
          deleteIcon={<RotateCcw size={18}/>}
          onDelete={()=>{setDraftTripType("all");setDraftYears([]);setDraftMembers([]);setSelectedMembers([]);setTripType("all");setSelectedYears([]);setFiltersOpen(false)}}
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
          <TripMemberFilter members={filterMembers} selected={draftMembers} onChange={setDraftMembers}/>
        </BottomSheet>:null}
        <TripSegmentedFilter value={kindFilter} options={kindFilters} onChange={setKindFilter} ariaLabel="กรองทริปที่เล็งไว้" tripLabel="ทริป" className="trip-ideas-type-filter"/>
        <section className="trip-ideas-list" aria-label="รายการทริปที่เล็งไว้">
          {refreshing?<FetchSkeleton rows={4} label="กำลังโหลดทริปที่เล็งไว้" />:filteredIdeas.length?<div className="trip-idea-groups">
            {plannedIdeas.length?<section className="trip-ideas-group" aria-label="ทริปที่เล็งไว้"><div className="trip-ideas-grid">{plannedIdeas.map(idea=><IdeaCard key={idea.id} idea={idea} edit={()=>openForm(idea)} convert={()=>convertToTrip(idea)} share={()=>setSharing(idea)} toggleFavorite={()=>void toggleFavorite(idea)} favoriteBusy={favoriteBusyId===idea.id}/>)}</div></section>:null}
            {somedayIdeas.length?<section className="trip-ideas-group" aria-label="ลิสต์สักวันหนึ่ง">{kindFilter==="all"?<div className="trip-ideas-divider"><span/><h2>ลิสต์สักวันหนึ่ง</h2><span/></div>:null}<div className="trip-ideas-grid">{somedayIdeas.map(idea=><IdeaCard key={idea.id} idea={idea} edit={()=>openForm(idea)} share={()=>setSharing(idea)} toggleFavorite={()=>void toggleFavorite(idea)} favoriteBusy={favoriteBusyId===idea.id}/>)}</div></section>:null}
          </div>:<EmptyState icon={Search} title={hasActiveTripFilters?"ไม่พบทริปที่ตรงกับตัวกรอง":query?"ไม่พบทริปที่ค้นหา":kindFilter==="favorite"?"ยังไม่มีทริปที่ติดดาว":kindFilter!=="all"?"ยังไม่มีทริปในหมวดนี้":"ยังไม่มีทริปที่เล็งไว้"} description={hasActiveTripFilters?"ลองเปลี่ยนประเภททริปหรือปีที่เลือก":query?"ลองค้นหาด้วยชื่อเมืองหรือประเทศอื่น":kindFilter==="favorite"?"กดหัวใจบนการ์ดทริปที่เล็งไว้เพื่อเก็บไว้ที่นี่":kindFilter!=="all"?"ลองเลือกหมวดอื่น หรือเพิ่มทริปใหม่":"เพิ่มสถานที่ที่อยากไปเก็บไว้ก่อนได้"} action="สร้างทริปที่เล็งไว้" onClick={()=>openForm(null)}/>}
        </section>
      </div>
    </main>
    {editing?<IdeaForm key={`${editing.idea?.id||"new"}:${editing.promote}`} editor={editing} close={()=>setEditing(undefined)} save={save} requestDelete={()=>editing.idea&&askRemove(editing.idea)} busy={busy}/>:null}
    {sharing?<IdeaCollaboratorsSheet key={sharing.id} idea={sharing} close={()=>setSharing(null)} onChanged={()=>void refreshIdea(sharing.id)} confirm={setConfirmation} notify={notify}/>:null}
    {confirmation?<ConfirmDialog confirmation={confirmation} close={()=>setConfirmation(null)}/>:null}
  </div>;
}
