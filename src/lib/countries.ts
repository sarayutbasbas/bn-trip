export type TripCountry = {
  code: string;
  flag: string;
  nameTh: string;
  nameEn: string;
  timezone: string;
  aliases?: string[];
};

export const TRIP_COUNTRIES: readonly TripCountry[] = [
  { code: "TH", flag: "🇹🇭", nameTh: "ไทย", nameEn: "Thailand", timezone: "Asia/Bangkok", aliases: ["ไทย", "thailand"] },
  { code: "JP", flag: "🇯🇵", nameTh: "ญี่ปุ่น", nameEn: "Japan", timezone: "Asia/Tokyo", aliases: ["ญี่ปุ่น", "japan"] },
  { code: "CN", flag: "🇨🇳", nameTh: "จีน", nameEn: "China", timezone: "Asia/Shanghai", aliases: ["จีน", "china"] },
  { code: "KR", flag: "🇰🇷", nameTh: "เกาหลีใต้", nameEn: "South Korea", timezone: "Asia/Seoul", aliases: ["เกาหลี", "south korea", "korea"] },
  { code: "TW", flag: "🇹🇼", nameTh: "ไต้หวัน", nameEn: "Taiwan", timezone: "Asia/Taipei", aliases: ["ไต้หวัน", "taiwan"] },
  { code: "HK", flag: "🇭🇰", nameTh: "ฮ่องกง", nameEn: "Hong Kong", timezone: "Asia/Hong_Kong", aliases: ["ฮ่องกง", "hong kong"] },
  { code: "SG", flag: "🇸🇬", nameTh: "สิงคโปร์", nameEn: "Singapore", timezone: "Asia/Singapore", aliases: ["สิงคโปร์", "singapore"] },
  { code: "VN", flag: "🇻🇳", nameTh: "เวียดนาม", nameEn: "Vietnam", timezone: "Asia/Ho_Chi_Minh", aliases: ["เวียดนาม", "vietnam"] },
  { code: "MY", flag: "🇲🇾", nameTh: "มาเลเซีย", nameEn: "Malaysia", timezone: "Asia/Kuala_Lumpur", aliases: ["มาเลเซีย", "malaysia"] },
  { code: "ID", flag: "🇮🇩", nameTh: "อินโดนีเซีย", nameEn: "Indonesia", timezone: "Asia/Jakarta", aliases: ["อินโดนีเซีย", "indonesia"] },
  { code: "PH", flag: "🇵🇭", nameTh: "ฟิลิปปินส์", nameEn: "Philippines", timezone: "Asia/Manila", aliases: ["ฟิลิปปินส์", "philippines"] },
  { code: "LA", flag: "🇱🇦", nameTh: "ลาว", nameEn: "Laos", timezone: "Asia/Vientiane", aliases: ["ลาว", "laos"] },
  { code: "KH", flag: "🇰🇭", nameTh: "กัมพูชา", nameEn: "Cambodia", timezone: "Asia/Phnom_Penh", aliases: ["กัมพูชา", "cambodia"] },
  { code: "MM", flag: "🇲🇲", nameTh: "เมียนมา", nameEn: "Myanmar", timezone: "Asia/Yangon", aliases: ["เมียนมา", "พม่า", "myanmar"] },
  { code: "IN", flag: "🇮🇳", nameTh: "อินเดีย", nameEn: "India", timezone: "Asia/Kolkata", aliases: ["อินเดีย", "india"] },
  { code: "AE", flag: "🇦🇪", nameTh: "สหรัฐอาหรับเอมิเรตส์", nameEn: "United Arab Emirates", timezone: "Asia/Dubai", aliases: ["ยูเออี", "uae", "united arab emirates"] },
  { code: "GB", flag: "🇬🇧", nameTh: "สหราชอาณาจักร", nameEn: "United Kingdom", timezone: "Europe/London", aliases: ["อังกฤษ", "uk", "united kingdom"] },
  { code: "FR", flag: "🇫🇷", nameTh: "ฝรั่งเศส", nameEn: "France", timezone: "Europe/Paris", aliases: ["ฝรั่งเศส", "france"] },
  { code: "IT", flag: "🇮🇹", nameTh: "อิตาลี", nameEn: "Italy", timezone: "Europe/Rome", aliases: ["อิตาลี", "italy"] },
  { code: "DE", flag: "🇩🇪", nameTh: "เยอรมนี", nameEn: "Germany", timezone: "Europe/Berlin", aliases: ["เยอรมนี", "germany"] },
  { code: "CH", flag: "🇨🇭", nameTh: "สวิตเซอร์แลนด์", nameEn: "Switzerland", timezone: "Europe/Zurich", aliases: ["สวิตเซอร์แลนด์", "switzerland"] },
  { code: "ES", flag: "🇪🇸", nameTh: "สเปน", nameEn: "Spain", timezone: "Europe/Madrid", aliases: ["สเปน", "spain"] },
  { code: "US", flag: "🇺🇸", nameTh: "สหรัฐอเมริกา", nameEn: "United States", timezone: "America/New_York", aliases: ["อเมริกา", "usa", "united states"] },
  { code: "CA", flag: "🇨🇦", nameTh: "แคนาดา", nameEn: "Canada", timezone: "America/Toronto", aliases: ["แคนาดา", "canada"] },
  { code: "AU", flag: "🇦🇺", nameTh: "ออสเตรเลีย", nameEn: "Australia", timezone: "Australia/Sydney", aliases: ["ออสเตรเลีย", "australia"] },
  { code: "NZ", flag: "🇳🇿", nameTh: "นิวซีแลนด์", nameEn: "New Zealand", timezone: "Pacific/Auckland", aliases: ["นิวซีแลนด์", "new zealand"] },
] as const;

export function countryByCode(code?: string | null) {
  return TRIP_COUNTRIES.find((country) => country.code === code?.toUpperCase());
}

export function inferTripCountry(destination?: string | null, timezone?: string | null) {
  const normalized = (destination || "").trim().toLowerCase();
  const byName = TRIP_COUNTRIES.find((country) =>
    [country.nameTh, country.nameEn, ...(country.aliases || [])].some((name) =>
      normalized.includes(name.toLowerCase()),
    ),
  );
  return byName || TRIP_COUNTRIES.find((country) => country.timezone === timezone) || TRIP_COUNTRIES[0];
}

export function tripCity(destination?: string | null) {
  return (destination || "").split(",")[0]?.trim() || "";
}

export function formatTripDestination(
  destination?: string | null,
  countryCode?: string | null,
  countryName?: string | null,
) {
  const city = tripCity(destination);
  const country = countryByCode(countryCode)?.nameEn || countryName?.trim() || "";
  if (!city || !country || city.toLowerCase() === country.toLowerCase()) {
    return city || country;
  }
  return `${city}, ${country}`;
}
