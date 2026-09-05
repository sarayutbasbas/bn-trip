export type BookingPlatform =
  | "agoda"
  | "trip.com"
  | "booking.com"
  | "klook";

export const BOOKING_PLATFORMS: Array<{
  value: BookingPlatform;
  label: string;
  icon: string;
}> = [
  { value: "agoda", label: "Agoda", icon: "/booking-platforms/agoda.svg" },
  {
    value: "trip.com",
    label: "Trip.com",
    icon: "/booking-platforms/trip-dot-com.svg",
  },
  {
    value: "booking.com",
    label: "Booking.com",
    icon: "/booking-platforms/booking-dot-com.svg",
  },
  { value: "klook", label: "Klook", icon: "/booking-platforms/klook.svg" },
];

export function bookingPlatformByValue(value?: string | null) {
  return BOOKING_PLATFORMS.find((option) => option.value === value);
}
