const DEMO_USER_ID="d0000000-0000-4000-8000-000000000001";

function isoDate(offset:number){const date=new Date();date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)}
function timestamp(date:string,time:string){return `${date}T${time}:00`}

const demoProfile={id:DEMO_USER_ID,email:"demo@packandgo.app",display_name:"Pack & Go+ Explorer",avatar_url:"/pack-and-go-icon-512.png"};
const demoCards=[
  {id:"d3000000-0000-4000-8000-000000000001",nickname:"Travel Visa",brand:"visa",last_four:"2026",is_active:true,sort_order:0,owner_id:DEMO_USER_ID,owner_name:demoProfile.display_name,owner_email:demoProfile.email,owner_avatar_url:demoProfile.avatar_url,is_own:true,member_role:"owner"},
  {id:"d3000000-0000-4000-8000-000000000002",nickname:"Journey JCB",brand:"jcb",last_four:"8899",is_active:true,sort_order:1,owner_id:DEMO_USER_ID,owner_name:demoProfile.display_name,owner_email:demoProfile.email,owner_avatar_url:demoProfile.avatar_url,is_own:true,member_role:"owner"},
];

function buildTrips(){
  const ongoingStart=isoDate(-1),ongoingEnd=isoDate(3),upcomingStart=isoDate(35),upcomingEnd=isoDate(39),pastStart=isoDate(-90),pastEnd=isoDate(-87);
  return [
    {id:"d1000000-0000-4000-8000-000000000001",owner_id:DEMO_USER_ID,name:"Kyoto Slow Days",destination:"Kyoto, Japan",start_date:ongoingStart,total_days:5,traveller_count:2,budget_thb:"45000.00",shopping_budget_thb:"12000.00",outbound_departure_at:timestamp(ongoingStart,"08:30"),return_departure_at:timestamp(ongoingEnd,"19:00"),cover_image_url:"/travel-postcard-background.jpg",google_photos_url:null,access_role:"owner",members:[]},
    {id:"d1000000-0000-4000-8000-000000000002",owner_id:DEMO_USER_ID,name:"Fukuoka Food Trip",destination:"Fukuoka, Japan",start_date:upcomingStart,total_days:5,traveller_count:2,budget_thb:"60000.00",shopping_budget_thb:"15000.00",outbound_departure_at:timestamp(upcomingStart,"07:15"),return_departure_at:timestamp(upcomingEnd,"21:20"),cover_image_url:"/travel-postcard-fallback.jpg",google_photos_url:null,access_role:"owner",members:[]},
    {id:"d1000000-0000-4000-8000-000000000003",owner_id:DEMO_USER_ID,name:"Hokkaido Winter Memory",destination:"Sapporo, Japan",start_date:pastStart,total_days:4,traveller_count:2,budget_thb:"80000.00",shopping_budget_thb:"20000.00",outbound_departure_at:timestamp(pastStart,"09:00"),return_departure_at:timestamp(pastEnd,"18:30"),cover_image_url:"/travel-postcard-background.jpg",google_photos_url:null,access_role:"owner",members:[],review_average:5,review_count:1},
  ];
}

function cost(id:string,key:string,category:string,foreignAmount:number,currency:string,exchangeRate:number,paymentMethod:string,creditCardId?:string){return {id,key,category,foreignAmount,currency,exchangeRate,rateDate:isoDate(-1),paymentMethod,creditCardId,value:Math.round(foreignAmount*exchangeRate*100)/100}}

function buildItineraries(){
  const cash="เงินสด",visa="Travel Visa · x-2026",jcb="Journey JCB · x-8899";
  return {
    "d1000000-0000-4000-8000-000000000001":[
      {id:"d2000000-0000-4000-8000-000000000001",trip_id:"d1000000-0000-4000-8000-000000000001",day_number:1,time_slot:"morning",start_time:"09:00:00",place_name:"Fushimi Inari Taisha",address:"Fushimi Ward, Kyoto",image_url:null,transport_mode:"รถไฟ",transport_note:"เริ่มเช้าเพื่อเดินชมเสาโทริอิแบบคนไม่เยอะ\nแวะร้านชาเล็ก ๆ ระหว่างทาง",sort_order:0,cost_items:[cost("dc000001","รถไฟเข้าเมือง","เดินทาง",460,"JPY",.22,cash),cost("dc000002","อาหารเช้า","อาหาร",1800,"JPY",.22,visa,demoCards[0].id)]},
      {id:"d2000000-0000-4000-8000-000000000002",trip_id:"d1000000-0000-4000-8000-000000000001",day_number:1,time_slot:"afternoon",start_time:"13:30:00",place_name:"Kiyomizu-dera",address:"Higashiyama, Kyoto",image_url:null,transport_mode:"เดิน",transport_note:"เดินเล่นย่าน Sannenzaka และ Ninenzaka",sort_order:1,cost_items:[cost("dc000003","ค่าเข้าวัด","กิจกรรม",500,"JPY",.22,cash),cost("dc000004","ขนมมัทฉะ","อาหาร",1250,"JPY",.22,jcb,demoCards[1].id)]},
      {id:"d2000000-0000-4000-8000-000000000003",trip_id:"d1000000-0000-4000-8000-000000000001",day_number:1,time_slot:"evening",start_time:"18:30:00",place_name:"Gion Evening Walk",address:"Gion, Kyoto",image_url:null,transport_mode:"เดิน",transport_note:"มื้อเย็นแบบไคเซกิ และเดินชมเมืองช่วงค่ำ",sort_order:2,cost_items:[cost("dc000005","มื้อเย็นไคเซกิ","อาหาร",9800,"JPY",.22,visa,demoCards[0].id)]},
      {id:"d2000000-0000-4000-8000-000000000004",trip_id:"d1000000-0000-4000-8000-000000000001",day_number:2,time_slot:"morning",start_time:"08:00:00",place_name:"Arashiyama Bamboo Grove",address:"Arashiyama, Kyoto",image_url:null,transport_mode:"รถไฟ",transport_note:"เดินป่าไผ่ ต่อด้วยสะพาน Togetsukyo",sort_order:0,cost_items:[cost("dc000006","กาแฟและขนม","อาหาร",1400,"JPY",.22,cash),cost("dc000007","ของฝาก","Shopping",7200,"JPY",.22,jcb,demoCards[1].id)]},
      {id:"d2000000-0000-4000-8000-000000000005",trip_id:"d1000000-0000-4000-8000-000000000001",day_number:3,time_slot:"morning",start_time:"10:00:00",place_name:"Nishiki Market",address:"Nakagyo Ward, Kyoto",image_url:null,transport_mode:"-",transport_note:"ลองอาหารท้องถิ่นและซื้อวัตถุดิบกลับบ้าน",sort_order:0,cost_items:[cost("dc000008","อาหารในตลาด","อาหาร",3600,"JPY",.22,cash)]},
    ],
    "d1000000-0000-4000-8000-000000000002":[
      {id:"d2000000-0000-4000-8000-000000000011",trip_id:"d1000000-0000-4000-8000-000000000002",day_number:1,time_slot:"morning",start_time:"10:00:00",place_name:"Ohori Park",address:"Chuo Ward, Fukuoka",image_url:null,transport_mode:"รถไฟ",transport_note:"เดินเล่นรอบทะเลสาบก่อนเริ่มทริปกิน",sort_order:0,cost_items:[cost("dc000011","บัตรรถไฟ","เดินทาง",620,"JPY",.22,cash)]},
      {id:"d2000000-0000-4000-8000-000000000012",trip_id:"d1000000-0000-4000-8000-000000000002",day_number:1,time_slot:"evening",start_time:"19:00:00",place_name:"Nakasu Yatai",address:"Nakasu, Fukuoka",image_url:null,transport_mode:"เดิน",transport_note:"ลองราเม็งฮากาตะและเมนไทโกะ",sort_order:1,cost_items:[cost("dc000012","มื้อเย็น Yatai","อาหาร",5200,"JPY",.22,visa,demoCards[0].id)]},
    ],
    "d1000000-0000-4000-8000-000000000003":[
      {id:"d2000000-0000-4000-8000-000000000021",trip_id:"d1000000-0000-4000-8000-000000000003",day_number:1,time_slot:"afternoon",start_time:"14:00:00",place_name:"Odori Snow Festival",address:"Odori Park, Sapporo",image_url:null,transport_mode:"รถไฟ",transport_note:"ชมประติมากรรมหิมะและไฟช่วงเย็น",sort_order:0,cost_items:[cost("dc000021","ซุปข้าวโพด","อาหาร",550,"JPY",.22,cash),cost("dc000022","ถุงมือกันหนาว","Shopping",4200,"JPY",.22,visa,demoCards[0].id)]},
    ],
  };
}

export function isDemoTrip(id:string){return buildTrips().some(trip=>trip.id===id)}
export function getDemoProfile(){return demoProfile}
export function getDemoCards(){return demoCards}
export function getDemoTrip(id:string){return buildTrips().find(trip=>trip.id===id)??null}
export function getDemoItineraries(id:string){return (buildItineraries() as Record<string,unknown[]>)[id]??[]}

export function getDemoFlightSegments(id:string){
  if(id!=="d1000000-0000-4000-8000-000000000001")return [];
  const departureDate=isoDate(3),arrivalDate=isoDate(3);
  const scheduledDeparture=timestamp(departureDate,"18:45");
  const scheduledArrival=timestamp(arrivalDate,"23:15");
  return [{
    id:"d4000000-0000-4000-8000-000000000001",trip_id:id,journey_type:"return",segment_order:0,
    airline_code:"TG",airline_name:"Thai Airways International",flight_number:"673",
    departure_airport_code:"KIX",departure_airport_name:"Kansai International Airport",
    arrival_airport_code:"BKK",arrival_airport_name:"Suvarnabhumi Airport",
    scheduled_departure_at:scheduledDeparture,scheduled_arrival_at:scheduledArrival,
    entered_departure_local_text:`${departureDate}T18:45`,entered_arrival_local_text:`${arrivalDate}T23:15`,
    latest_departure_at:timestamp(departureDate,"18:55"),latest_arrival_at:timestamp(arrivalDate,"23:25"),
    departure_terminal:"1",departure_gate:"28",arrival_terminal:"Main",arrival_gate:"D4",
    status:"scheduled",booking_reference:"BNDEMO",cabin_class:"Economy",baggage_note:null,
    ticket_price:"18500.00",ticket_currency:"THB",ticket_exchange_rate:"1",ticket_rate_date:departureDate,
    last_synced_at:new Date().toISOString(),provider:"demo",provider_flight_id:"demo-tg673",
    passengers:[{user_id:DEMO_USER_ID,seat_number:"35A",meal_preference:"Thai meal",carry_on_baggage:"7 kg",checked_baggage:"23 kg",display_name:demoProfile.display_name,avatar_url:demoProfile.avatar_url}],
    documents:[],
  }];
}

export function getDemoNearbyFlights(){
  const trip=getDemoTrip("d1000000-0000-4000-8000-000000000001");
  return getDemoFlightSegments(trip!.id).map(flight=>({
    ...flight,
    trip_name:trip!.name,
    trip_destination:trip!.destination,
    cover_image_url:trip!.cover_image_url,
  }));
}

export function getDemoTrips(params:URLSearchParams){
  const trips=buildTrips();const now=Date.now();const departure=(trip:(typeof trips)[number])=>new Date(trip.outbound_departure_at).getTime();const arrival=(trip:(typeof trips)[number])=>new Date(trip.return_departure_at).getTime();const ongoing=trips.filter(trip=>departure(trip)<=now&&arrival(trip)>=now);const upcoming=trips.filter(trip=>departure(trip)>now);const past=trips.filter(trip=>arrival(trip)<now);
  if(params.get("mode")==="dashboard")return {ongoing,upcoming,past,counts:{total:trips.length,ongoing:ongoing.length,upcoming:upcoming.length,past:past.length},years:[...new Set(trips.map(trip=>Number(trip.start_date.slice(0,4))))].sort((a,b)=>b-a)};
  if(params.get("mode")!=="list")return trips;
  const status=params.get("status")||"all",year=Number(params.get("year")||0),search=(params.get("q")||"").trim().toLowerCase(),sort=params.get("sort")||"latest",limit=Math.min(50,Math.max(1,Number(params.get("limit")||20))),offset=Math.max(0,Number(params.get("offset")||0));
  let items=trips.filter(trip=>(status==="all"||(status==="ongoing"&&ongoing.includes(trip))||(status==="upcoming"&&upcoming.includes(trip))||(status==="past"&&past.includes(trip)))&&(!year||Number(trip.start_date.slice(0,4))===year)&&(!search||`${trip.name} ${trip.destination}`.toLowerCase().includes(search)));
  items=[...items].sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="oldest"?departure(a)-departure(b):sort==="nearest"?Math.abs(departure(a)-now)-Math.abs(departure(b)-now):arrival(b)-arrival(a));
  return {items:items.slice(offset,offset+limit),total:items.length,years:[...new Set(trips.map(trip=>Number(trip.start_date.slice(0,4))))].sort((a,b)=>b-a),hasMore:offset+limit<items.length};
}

export {DEMO_USER_ID};
