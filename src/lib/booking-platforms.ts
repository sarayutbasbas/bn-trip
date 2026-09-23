export type BookingPlatform =
  | "agoda"
  | "trip.com"
  | "booking.com"
  | "klook"
  | "traveloka"
  | "direct";

export const BOOKING_PLATFORMS: Array<{
  value: BookingPlatform;
  label: string;
  icon: string;
}> = [
  { value: "agoda", label: "Agoda", icon: "/images/applications/agoda.png" },
  {
    value: "trip.com",
    label: "Trip.com",
    icon: "/images/applications/trip.png",
  },
  {
    value: "booking.com",
    label: "Booking.com",
    icon: "/images/applications/booking.png",
  },
  { value: "klook", label: "Klook", icon: "/images/applications/klook.png" },
  {
    value: "traveloka",
    label: "Traveloka",
    icon: "/images/applications/travelloka.png",
  },
  {
    value: "direct",
    label: "จองเอง / โทรจอง",
    icon: "/images/applications/direct.svg",
  },
];

export function bookingPlatformByValue(value?: string | null) {
  return BOOKING_PLATFORMS.find((option) => option.value === value);
}
