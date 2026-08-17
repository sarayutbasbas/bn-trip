import Image from "next/image";
import { Armchair, Briefcase, Luggage } from "lucide-react";

export type FlightPassengerInfo = {
  user_id: string;
  seat_number: string | null;
  meal_preference?: string | null;
  carry_on_baggage: string | null;
  checked_baggage: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function FlightPassengerInfoList({ passengers }: { passengers: FlightPassengerInfo[] }) {
  const seatedPassengers = passengers.filter((passenger) => passenger.seat_number);
  if (!seatedPassengers.length) return null;

  return (
    <div className="flight-passenger-info-list">
      {seatedPassengers.map((passenger) => {
        const name = passenger.display_name || "ผู้โดยสาร";
        const details = [passenger.seat_number, passenger.carry_on_baggage, passenger.checked_baggage].filter(Boolean).join(" ");
        return (
          <span className="flight-passenger-info-group" key={passenger.user_id} aria-label={`${name} ${details}`}>
            <span className="flight-passenger-info-profile" title={name}>
              {passenger.avatar_url ? (
                <Image src={passenger.avatar_url} alt={name} width={22} height={22} unoptimized />
              ) : (
                <i>{name[0] || "?"}</i>
              )}
            </span>
            <span className="flight-passenger-info-details">
              <span className="flight-passenger-info-value"><Armchair size={12} /><b>{passenger.seat_number}</b></span>
              {passenger.carry_on_baggage ? <span className="flight-passenger-info-value"><Briefcase size={12} /><b>{passenger.carry_on_baggage}</b></span> : null}
              {passenger.checked_baggage ? <span className="flight-passenger-info-value"><Luggage size={12} /><b>{passenger.checked_baggage}</b></span> : null}
            </span>
          </span>
        );
      })}
    </div>
  );
}
