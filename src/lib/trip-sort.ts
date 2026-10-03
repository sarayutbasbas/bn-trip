export const TRIP_SORT_OPTIONS = [
  { value: "latest", label: "แนะนำ", description: "ทริปปัจจุบัน ตามด้วยทริปที่กำลังจะไป" },
  { value: "newest", label: "วันเดินทาง: ใหม่ไปเก่า", description: "เริ่มจากวันเดินทางที่อยู่หลังสุด" },
  { value: "oldest", label: "วันเดินทาง: เก่าไปใหม่", description: "เริ่มจากวันเดินทางที่อยู่ก่อนสุด" },
  { value: "rating", label: "คะแนนเฉลี่ย: สูงไปต่ำ", description: "ใช้คะแนนที่คุณดูได้ · ทริปที่ยังไม่มีคะแนนอยู่ท้าย" },
  { value: "nearest", label: "วันเดินทางใกล้วันนี้ที่สุด", description: "รวมทั้งทริปที่ผ่านมาและกำลังจะไป" },
  { value: "name", label: "ชื่อทริป: ตามตัวอักษร", description: "ค้นหาทริปจากชื่อได้ง่ายขึ้น" },
] as const;

export type TripSort = typeof TRIP_SORT_OPTIONS[number]["value"];
export function normalizeTripSort(value: string): TripSort {
  return TRIP_SORT_OPTIONS.some(option => option.value === value) ? value as TripSort : "latest";
}
