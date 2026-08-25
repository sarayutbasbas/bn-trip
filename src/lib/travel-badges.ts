import { TRIP_COUNTRIES, inferTripCountry } from "@/src/lib/countries";

export type TravelBadgeCategory = "thailand" | "japan" | "international";

export type BadgeTripVisit = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
};

export type TravelBadgeDefinition = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  category: TravelBadgeCategory;
  countryCode: string;
  latitude: number;
  longitude: number;
  image: string;
  artworkIndex: number;
  aliases: string[];
};

export type TravelBadge = TravelBadgeDefinition & {
  unlocked: boolean;
  visits: BadgeTripVisit[];
  manualVisitDate: string | null;
};

export type TravelBadgeCollection = {
  badges: TravelBadge[];
  totals: Record<TravelBadgeCategory, { unlocked: number; total: number }>;
};

export type BadgeTripSource = {
  id: string;
  name: string;
  destination: string;
  country_code?: string | null;
  country_name?: string | null;
  start_date: string;
  total_days: number;
  return_departure_at?: string | null;
  trip_destinations?: TripDestinationSelection[] | null;
};

export type TripDestinationSelection = {
  id: string;
  countryCode: string;
  nameTh: string;
  nameEn: string;
  badgeId: string;
};

export type TripDestinationOption = TripDestinationSelection & { searchTerms: string[] };

export type ManualBadgeVisit = {
  badge_id: string;
  visited_on: string;
};

type BadgeSeed = readonly [slug: string, nameTh: string, nameEn: string, latitude: number, longitude: number, aliases?: readonly string[]];

const THAILAND: readonly BadgeSeed[] = [
  ["bangkok", "กรุงเทพมหานคร", "Bangkok", 13.7563, 100.5018, ["กรุงเทพ", "bkk"]],
  ["krabi", "กระบี่", "Krabi", 8.0863, 98.9063], ["kanchanaburi", "กาญจนบุรี", "Kanchanaburi", 14.0228, 99.5328],
  ["kalasin", "กาฬสินธุ์", "Kalasin", 16.4322, 103.5066], ["kamphaeng_phet", "กำแพงเพชร", "Kamphaeng Phet", 16.4828, 99.5227],
  ["khon_kaen", "ขอนแก่น", "Khon Kaen", 16.4419, 102.835], ["chanthaburi", "จันทบุรี", "Chanthaburi", 12.6113, 102.1038],
  ["chachoengsao", "ฉะเชิงเทรา", "Chachoengsao", 13.6904, 101.0779], ["chonburi", "ชลบุรี", "Chon Buri", 13.3611, 100.9847, ["พัทยา", "pattaya"]],
  ["chainat", "ชัยนาท", "Chai Nat", 15.1852, 100.1251], ["chaiyaphum", "ชัยภูมิ", "Chaiyaphum", 15.8068, 102.0315],
  ["chumphon", "ชุมพร", "Chumphon", 10.493, 99.18], ["chiang_rai", "เชียงราย", "Chiang Rai", 19.9105, 99.8406],
  ["chiang_mai", "เชียงใหม่", "Chiang Mai", 18.7883, 98.9853], ["trang", "ตรัง", "Trang", 7.5594, 99.6114],
  ["trat", "ตราด", "Trat", 12.2428, 102.5175, ["เกาะช้าง", "koh chang"]], ["tak", "ตาก", "Tak", 16.8839, 99.1258],
  ["nakhon_nayok", "นครนายก", "Nakhon Nayok", 14.2069, 101.2131], ["nakhon_pathom", "นครปฐม", "Nakhon Pathom", 13.8199, 100.0622],
  ["nakhon_phanom", "นครพนม", "Nakhon Phanom", 17.392, 104.7695], ["nakhon_ratchasima", "นครราชสีมา", "Nakhon Ratchasima", 14.9799, 102.0978, ["โคราช", "korat", "khao yai", "เขาใหญ่"]],
  ["nakhon_si_thammarat", "นครศรีธรรมราช", "Nakhon Si Thammarat", 8.4304, 99.9631], ["nakhon_sawan", "นครสวรรค์", "Nakhon Sawan", 15.7047, 100.1372],
  ["nonthaburi", "นนทบุรี", "Nonthaburi", 13.8621, 100.5144], ["narathiwat", "นราธิวาส", "Narathiwat", 6.4255, 101.8253],
  ["nan", "น่าน", "Nan", 18.7756, 100.773], ["bueng_kan", "บึงกาฬ", "Bueng Kan", 18.3609, 103.6464],
  ["buriram", "บุรีรัมย์", "Buri Ram", 14.993, 103.1029], ["pathum_thani", "ปทุมธานี", "Pathum Thani", 14.0208, 100.525],
  ["prachuap_khiri_khan", "ประจวบคีรีขันธ์", "Prachuap Khiri Khan", 11.8124, 99.7973, ["หัวหิน", "hua hin"]],
  ["prachinburi", "ปราจีนบุรี", "Prachin Buri", 14.0509, 101.3724], ["pattani", "ปัตตานี", "Pattani", 6.8695, 101.2505],
  ["phra_nakhon_si_ayutthaya", "พระนครศรีอยุธยา", "Phra Nakhon Si Ayutthaya", 14.3532, 100.568, ["อยุธยา", "ayutthaya"]],
  ["phayao", "พะเยา", "Phayao", 19.1665, 99.9019], ["phang_nga", "พังงา", "Phang Nga", 8.4501, 98.5255, ["เขาหลัก", "khao lak"]],
  ["phatthalung", "พัทลุง", "Phatthalung", 7.6167, 100.074], ["phichit", "พิจิตร", "Phichit", 16.2741, 100.3347],
  ["phitsanulok", "พิษณุโลก", "Phitsanulok", 16.8211, 100.2659], ["phetchaburi", "เพชรบุรี", "Phetchaburi", 13.1119, 99.939],
  ["phetchabun", "เพชรบูรณ์", "Phetchabun", 16.4189, 101.1551, ["เขาค้อ", "khao kho"]], ["phrae", "แพร่", "Phrae", 18.1446, 100.1403],
  ["phuket", "ภูเก็ต", "Phuket", 7.8804, 98.3923], ["maha_sarakham", "มหาสารคาม", "Maha Sarakham", 16.0132, 103.1615],
  ["mukdahan", "มุกดาหาร", "Mukdahan", 16.5424, 104.7209], ["mae_hong_son", "แม่ฮ่องสอน", "Mae Hong Son", 19.302, 97.9654, ["ปาย", "pai"]],
  ["yasothon", "ยโสธร", "Yasothon", 15.7926, 104.1453], ["yala", "ยะลา", "Yala", 6.5411, 101.2804],
  ["roi_et", "ร้อยเอ็ด", "Roi Et", 16.0538, 103.652], ["ranong", "ระนอง", "Ranong", 9.9529, 98.6085],
  ["rayong", "ระยอง", "Rayong", 12.6814, 101.2816, ["เกาะเสม็ด", "koh samet"]], ["ratchaburi", "ราชบุรี", "Ratchaburi", 13.5283, 99.8134],
  ["lopburi", "ลพบุรี", "Lop Buri", 14.7995, 100.6534], ["lampang", "ลำปาง", "Lampang", 18.2888, 99.4909],
  ["lamphun", "ลำพูน", "Lamphun", 18.5745, 99.0087], ["loei", "เลย", "Loei", 17.486, 101.7223, ["เชียงคาน", "chiang khan"]],
  ["sisaket", "ศรีสะเกษ", "Si Sa Ket", 15.1186, 104.322], ["sakonnakhon", "สกลนคร", "Sakon Nakhon", 17.1546, 104.1348],
  ["songkhla", "สงขลา", "Songkhla", 7.1898, 100.5954, ["หาดใหญ่", "hat yai"]], ["satun", "สตูล", "Satun", 6.6238, 100.0674, ["หลีเป๊ะ", "lipe"]],
  ["samut_prakan", "สมุทรปราการ", "Samut Prakan", 13.5991, 100.5998], ["samut_songkhram", "สมุทรสงคราม", "Samut Songkhram", 13.4098, 100.0023, ["อัมพวา", "amphawa"]],
  ["samut_sakhon", "สมุทรสาคร", "Samut Sakhon", 13.5475, 100.2744], ["sa_kaeo", "สระแก้ว", "Sa Kaeo", 13.824, 102.0646],
  ["saraburi", "สระบุรี", "Saraburi", 14.5289, 100.9101], ["sing_buri", "สิงห์บุรี", "Sing Buri", 14.8936, 100.3967],
  ["sukhothai", "สุโขทัย", "Sukhothai", 17.0056, 99.8264], ["suphan_buri", "สุพรรณบุรี", "Suphan Buri", 14.4745, 100.1177],
  ["surat_thani", "สุราษฎร์ธานี", "Surat Thani", 9.1382, 99.3217, ["สมุย", "koh samui", "เกาะพะงัน", "koh phangan"]],
  ["surin", "สุรินทร์", "Surin", 14.8829, 103.4937], ["nong_khai", "หนองคาย", "Nong Khai", 17.8783, 102.7413],
  ["nong_bua_lamphu", "หนองบัวลำภู", "Nong Bua Lam Phu", 17.2218, 102.426], ["ang_thong", "อ่างทอง", "Ang Thong", 14.5896, 100.4551],
  ["amnatcharoen", "อำนาจเจริญ", "Amnat Charoen", 15.8657, 104.6258], ["udon_thani", "อุดรธานี", "Udon Thani", 17.4138, 102.7872],
  ["uttaradit", "อุตรดิตถ์", "Uttaradit", 17.6201, 100.0993], ["uthai_thani", "อุทัยธานี", "Uthai Thani", 15.3835, 100.0246],
  ["ubon_ratchathani", "อุบลราชธานี", "Ubon Ratchathani", 15.2448, 104.8473],
];

const JAPAN: readonly BadgeSeed[] = [
  ["hokkaido", "ฮอกไกโด", "Hokkaido", 43.0618, 141.3545, ["sapporo", "ซัปโปโร"]], ["aomori", "อาโอโมริ", "Aomori", 40.8222, 140.7474],
  ["iwate", "อิวาเตะ", "Iwate", 39.7036, 141.1527, ["morioka"]], ["miyagi", "มิยางิ", "Miyagi", 38.2682, 140.8694, ["sendai", "เซนได"]],
  ["akita", "อาคิตะ", "Akita", 39.7199, 140.1025], ["yamagata", "ยามากาตะ", "Yamagata", 38.2404, 140.3633],
  ["fukushima", "ฟุกุชิมะ", "Fukushima", 37.7503, 140.4676], ["ibaraki", "อิบารากิ", "Ibaraki", 36.3418, 140.4468, ["mito"]],
  ["tochigi", "โทจิงิ", "Tochigi", 36.5657, 139.8836, ["nikko", "นิกโก้", "utsunomiya"]], ["gunma", "กุนมะ", "Gunma", 36.3911, 139.0608],
  ["saitama", "ไซตามะ", "Saitama", 35.8617, 139.6455], ["chiba", "ชิบะ", "Chiba", 35.6073, 140.1063, ["narita", "นาริตะ"]],
  ["tokyo", "โตเกียว", "Tokyo", 35.6762, 139.6503], ["kanagawa", "คานางาวะ", "Kanagawa", 35.4478, 139.6425, ["yokohama", "โยโกฮาม่า", "kamakura"]],
  ["niigata", "นีงาตะ", "Niigata", 37.9026, 139.0232], ["toyama", "โทยามะ", "Toyama", 36.6953, 137.2113],
  ["ishikawa", "อิชิกาวะ", "Ishikawa", 36.5947, 136.6256, ["kanazawa", "คานาซาวะ"]], ["fukui", "ฟุกุอิ", "Fukui", 36.0652, 136.2216],
  ["yamanashi", "ยามานาชิ", "Yamanashi", 35.6642, 138.5684, ["fuji", "ฟูจิ", "kawaguchiko"]], ["nagano", "นากาโนะ", "Nagano", 36.6513, 138.181],
  ["gifu", "กิฟุ", "Gifu", 35.4233, 136.7607, ["takayama", "shirakawago"]], ["shizuoka", "ชิซูโอกะ", "Shizuoka", 34.9756, 138.3828],
  ["aichi", "ไอจิ", "Aichi", 35.1802, 136.9066, ["nagoya", "นาโกย่า"]], ["mie", "มิเอะ", "Mie", 34.7303, 136.5086],
  ["shiga", "ชิงะ", "Shiga", 35.0045, 135.8686], ["kyoto", "เกียวโต", "Kyoto", 35.0116, 135.7681],
  ["osaka", "โอซาก้า", "Osaka", 34.6937, 135.5023], ["hyogo", "เฮียวโงะ", "Hyogo", 34.6901, 135.1955, ["kobe", "โกเบ"]],
  ["nara", "นารา", "Nara", 34.6851, 135.8048], ["wakayama", "วากายามะ", "Wakayama", 34.226, 135.1675],
  ["tottori", "ทตโตริ", "Tottori", 35.5011, 134.2351], ["shimane", "ชิมาเนะ", "Shimane", 35.4723, 133.0505],
  ["okayama", "โอกายามะ", "Okayama", 34.6551, 133.9195], ["hiroshima", "ฮิโรชิมะ", "Hiroshima", 34.3853, 132.4553],
  ["yamaguchi", "ยามากุจิ", "Yamaguchi", 34.1859, 131.4714], ["tokushima", "โทคุชิมะ", "Tokushima", 34.0703, 134.5548],
  ["kagawa", "คางาวะ", "Kagawa", 34.3401, 134.0434, ["takamatsu"]], ["ehime", "เอฮิเมะ", "Ehime", 33.8416, 132.7657, ["matsuyama"]],
  ["kochi", "โคจิ", "Kochi", 33.5597, 133.5311], ["fukuoka", "ฟุกุโอกะ", "Fukuoka", 33.5904, 130.4017],
  ["saga", "ซางะ", "Saga", 33.2494, 130.2988], ["nagasaki", "นางาซากิ", "Nagasaki", 32.7503, 129.8779],
  ["kumamoto", "คุมาโมโตะ", "Kumamoto", 32.8031, 130.7079], ["oita", "โออิตะ", "Oita", 33.2396, 131.6093, ["beppu", "เบปปุ"]],
  ["miyazaki", "มิยาซากิ", "Miyazaki", 31.9111, 131.4239], ["kagoshima", "คาโกชิมะ", "Kagoshima", 31.5966, 130.5571],
  ["okinawa", "โอกินาวะ", "Okinawa", 26.2124, 127.6809, ["naha", "นาฮะ"]],
];

const COUNTRY_CENTERS: Record<string, readonly [number, number]> = {
  CN: [35.8617, 104.1954], KR: [35.9078, 127.7669], TW: [23.6978, 120.9605], HK: [22.3193, 114.1694],
  SG: [1.3521, 103.8198], VN: [14.0583, 108.2772], MY: [4.2105, 101.9758], ID: [-0.7893, 113.9213],
  PH: [12.8797, 121.774], LA: [19.8563, 102.4955], KH: [12.5657, 104.991], MM: [21.9162, 95.956],
  IN: [20.5937, 78.9629], AE: [23.4241, 53.8478], GB: [55.3781, -3.436], FR: [46.2276, 2.2137],
  IT: [41.8719, 12.5674], DE: [51.1657, 10.4515], CH: [46.8182, 8.2275], ES: [40.4637, -3.7492],
  US: [37.0902, -95.7129], CA: [56.1304, -106.3468], AU: [-25.2744, 133.7751], NZ: [-40.9006, 174.886],
};

function seedToBadge(seed: BadgeSeed, category: TravelBadgeCategory, countryCode: string, artworkIndex: number): TravelBadgeDefinition {
  const [slug, nameTh, nameEn, latitude, longitude, aliases = []] = seed;
  return {
    id: `${category}:${slug}`,
    slug, nameTh, nameEn, category, countryCode, latitude, longitude,
    image: `/images/badges/${category}/${slug}.webp?v=generated-20260825-v2`, artworkIndex,
    aliases: [nameTh, nameEn, slug.replaceAll("_", " "), ...aliases].map((item) => item.toLowerCase()),
  };
}

export const TRAVEL_BADGE_CATALOG: readonly TravelBadgeDefinition[] = [
  ...THAILAND.map((seed, index) => seedToBadge(seed, "thailand", "TH", index)),
  ...JAPAN.map((seed, index) => seedToBadge(seed, "japan", "JP", index)),
  ...TRIP_COUNTRIES.filter((country) => country.code !== "TH" && country.code !== "JP").map((country, artworkIndex) => {
    const [latitude, longitude] = COUNTRY_CENTERS[country.code] || [0, 0];
    const slug = country.nameEn.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_|_$/g, "");
    return {
      id: `international:${slug}`, slug, nameTh: country.nameTh, nameEn: country.nameEn,
      category: "international" as const, countryCode: country.code, latitude, longitude,
      image: `/images/badges/international/${slug}.webp?v=generated-20260825-v2`,
      artworkIndex,
      aliases: [country.nameTh, country.nameEn, ...(country.aliases || [])].map((item) => item.toLowerCase()),
    };
  }),
];

const INTERNATIONAL_CITIES: Record<string, readonly (readonly [string, string, string])[]> = {
  CN: [["beijing", "ปักกิ่ง", "Beijing"], ["shanghai", "เซี่ยงไฮ้", "Shanghai"], ["chengdu", "เฉิงตู", "Chengdu"], ["guangzhou", "กวางโจว", "Guangzhou"]],
  KR: [["seoul", "โซล", "Seoul"], ["busan", "ปูซาน", "Busan"], ["jeju", "เชจู", "Jeju"]],
  TW: [["taipei", "ไทเป", "Taipei"], ["kaohsiung", "เกาสง", "Kaohsiung"], ["taichung", "ไถจง", "Taichung"]],
  HK: [["hong_kong", "ฮ่องกง", "Hong Kong"]], SG: [["singapore", "สิงคโปร์", "Singapore"]],
  VN: [["hanoi", "ฮานอย", "Hanoi"], ["ho_chi_minh_city", "โฮจิมินห์ซิตี้", "Ho Chi Minh City"], ["da_nang", "ดานัง", "Da Nang"]],
  MY: [["kuala_lumpur", "กัวลาลัมเปอร์", "Kuala Lumpur"], ["penang", "ปีนัง", "Penang"], ["kota_kinabalu", "โกตากีนาบาลู", "Kota Kinabalu"]],
  ID: [["bali", "บาหลี", "Bali"], ["jakarta", "จาการ์ตา", "Jakarta"], ["yogyakarta", "ยอกยาการ์ตา", "Yogyakarta"]],
  PH: [["manila", "มะนิลา", "Manila"], ["cebu", "เซบู", "Cebu"], ["palawan", "ปาลาวัน", "Palawan"]],
  LA: [["vientiane", "เวียงจันทน์", "Vientiane"], ["luang_prabang", "หลวงพระบาง", "Luang Prabang"]],
  KH: [["phnom_penh", "พนมเปญ", "Phnom Penh"], ["siem_reap", "เสียมราฐ", "Siem Reap"]],
  MM: [["yangon", "ย่างกุ้ง", "Yangon"], ["mandalay", "มัณฑะเลย์", "Mandalay"], ["bagan", "พุกาม", "Bagan"]],
  IN: [["delhi", "เดลี", "Delhi"], ["mumbai", "มุมไบ", "Mumbai"], ["jaipur", "ชัยปุระ", "Jaipur"]],
  AE: [["dubai", "ดูไบ", "Dubai"], ["abu_dhabi", "อาบูดาบี", "Abu Dhabi"]],
  GB: [["london", "ลอนดอน", "London"], ["edinburgh", "เอดินบะระ", "Edinburgh"], ["manchester", "แมนเชสเตอร์", "Manchester"]],
  FR: [["paris", "ปารีส", "Paris"], ["nice", "นีซ", "Nice"], ["lyon", "ลียง", "Lyon"]],
  IT: [["rome", "โรม", "Rome"], ["milan", "มิลาน", "Milan"], ["venice", "เวนิส", "Venice"], ["florence", "ฟลอเรนซ์", "Florence"]],
  DE: [["berlin", "เบอร์ลิน", "Berlin"], ["munich", "มิวนิก", "Munich"], ["frankfurt", "แฟรงก์เฟิร์ต", "Frankfurt"]],
  CH: [["zurich", "ซูริก", "Zurich"], ["lucerne", "ลูเซิร์น", "Lucerne"], ["interlaken", "อินเทอร์ลาเคน", "Interlaken"]],
  ES: [["madrid", "มาดริด", "Madrid"], ["barcelona", "บาร์เซโลนา", "Barcelona"], ["seville", "เซบียา", "Seville"]],
  US: [["new_york", "นิวยอร์ก", "New York"], ["los_angeles", "ลอสแอนเจลิส", "Los Angeles"], ["san_francisco", "ซานฟรานซิสโก", "San Francisco"], ["las_vegas", "ลาสเวกัส", "Las Vegas"]],
  CA: [["toronto", "โทรอนโต", "Toronto"], ["vancouver", "แวนคูเวอร์", "Vancouver"], ["montreal", "มอนทรีออล", "Montreal"]],
  AU: [["sydney", "ซิดนีย์", "Sydney"], ["melbourne", "เมลเบิร์น", "Melbourne"], ["brisbane", "บริสเบน", "Brisbane"], ["perth", "เพิร์ท", "Perth"]],
  NZ: [["auckland", "โอ๊คแลนด์", "Auckland"], ["queenstown", "ควีนส์ทาวน์", "Queenstown"], ["christchurch", "ไครสต์เชิร์ช", "Christchurch"]],
};

export const TRIP_DESTINATION_OPTIONS: readonly TripDestinationOption[] = [
  ...TRAVEL_BADGE_CATALOG.filter((badge) => badge.category !== "international").map((badge) => ({
    id: `${badge.countryCode}:${badge.slug}`,
    countryCode: badge.countryCode,
    nameTh: badge.nameTh,
    nameEn: badge.nameEn,
    badgeId: badge.id,
    searchTerms: badge.aliases,
  })),
  ...TRAVEL_BADGE_CATALOG.filter((badge) => badge.category === "international").flatMap((badge) =>
    (INTERNATIONAL_CITIES[badge.countryCode] || [[badge.slug, badge.nameTh, badge.nameEn]]).map(([slug, nameTh, nameEn]) => ({
      id: `${badge.countryCode}:${slug}`,
      countryCode: badge.countryCode,
      nameTh,
      nameEn,
      badgeId: badge.id,
      searchTerms: [nameTh, nameEn, slug.replaceAll("_", " ")].map((term) => term.toLowerCase()),
    })),
  ),
];

export function resolveTripDestinations(countryCode: string, ids: string[]): TripDestinationSelection[] {
  const uniqueIds = new Set(ids);
  return TRIP_DESTINATION_OPTIONS.filter((option) => option.countryCode === countryCode && uniqueIds.has(option.id))
    .map((option) => ({ id: option.id, countryCode: option.countryCode, nameTh: option.nameTh, nameEn: option.nameEn, badgeId: option.badgeId }));
}

function tripEndDate(trip: BadgeTripSource) {
  if (trip.return_departure_at) return trip.return_departure_at.slice(0, 10);
  const date = new Date(`${trip.start_date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(0, Number(trip.total_days || 1) - 1));
  return date.toISOString().slice(0, 10);
}

function tripCountryCode(trip: BadgeTripSource) {
  return trip.country_code?.trim().toUpperCase() || inferTripCountry(`${trip.destination}, ${trip.country_name || ""}`).code;
}

function tripMatchesBadge(trip: BadgeTripSource, badge: TravelBadgeDefinition) {
  const code = tripCountryCode(trip);
  if (code !== badge.countryCode) return false;
  if (trip.trip_destinations?.length) {
    return trip.trip_destinations.some((destination) => destination.badgeId === badge.id);
  }
  if (badge.category === "international") return true;
  const haystack = `${trip.destination} ${trip.country_name || ""}`.toLowerCase();
  return badge.aliases.some((alias) => haystack.includes(alias));
}

export function buildTravelBadgeCollection(
  trips: BadgeTripSource[],
  manualVisits: ManualBadgeVisit[] = [],
): TravelBadgeCollection {
  const today = new Date().toISOString().slice(0, 10);
  const visitedTrips = trips.filter((trip) => trip.start_date.slice(0, 10) <= today);
  const manualVisitByBadge = new Map(manualVisits.map((visit) => [visit.badge_id, visit.visited_on.slice(0, 10)]));
  const badges = TRAVEL_BADGE_CATALOG.map((badge) => {
    const visits = visitedTrips.filter((trip) => tripMatchesBadge(trip, badge)).map((trip) => ({
      id: trip.id, name: trip.name, destination: trip.destination,
      startDate: trip.start_date.slice(0, 10), endDate: tripEndDate(trip),
    })).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const manualVisitDate = manualVisitByBadge.get(badge.id) || null;
    return { ...badge, unlocked: visits.length > 0 || Boolean(manualVisitDate), visits, manualVisitDate };
  });
  const categories: TravelBadgeCategory[] = ["thailand", "japan", "international"];
  return {
    badges,
    totals: Object.fromEntries(categories.map((category) => {
      const items = badges.filter((badge) => badge.category === category);
      return [category, { unlocked: items.filter((badge) => badge.unlocked).length, total: items.length }];
    })) as TravelBadgeCollection["totals"],
  };
}
