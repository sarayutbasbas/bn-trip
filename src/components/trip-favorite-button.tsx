"use client";

import { Heart } from "lucide-react";

export function TripFavoriteButton({ favorite, onToggle, disabled = false }: {
  favorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`trip-favorite-button${favorite ? " is-favorite" : ""}`}
      aria-label={favorite ? "นำออกจากทริปที่ติดดาว" : "ติดดาวทริปนี้"}
      aria-pressed={favorite}
      title={favorite ? "นำออกจากทริปที่ติดดาว" : "ติดดาวทริปนี้"}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Heart size={16} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
