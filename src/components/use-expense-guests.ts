"use client";
import { useEffect, useState } from "react";
type ExpenseGuest = { id: string; name: string };
export const EXPENSE_GUESTS_CHANGED_EVENT = "bn-trip:expense-guests-changed";

export function useExpenseGuests(tripId: string) {
  const [guests, setGuests] = useState<ExpenseGuest[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/expense-guests`);
        const data = await response.json();
        if (active && response.ok && Array.isArray(data)) setGuests(data);
      } catch {
        // The cost form stays usable for joined members if guest loading fails.
      }
    };
    void load();
    const onChanged = (event: Event) => {
      const changedTripId = (event as CustomEvent<{ tripId?: string }>).detail
        ?.tripId;
      if (!changedTripId || changedTripId === tripId) void load();
    };
    window.addEventListener(EXPENSE_GUESTS_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(EXPENSE_GUESTS_CHANGED_EVENT, onChanged);
    };
  }, [tripId]);
  return { guests, setGuests };
}
