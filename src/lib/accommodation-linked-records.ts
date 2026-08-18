import type { PoolClient } from "pg";
import { query } from "@/src/lib/db";
import { clearFirstItineraryTransport } from "@/src/lib/itinerary-order";

export type AccommodationLinkedInput = {
  id: string;
  tripId: string;
  name: string;
  location: string;
  description: string;
  checkInDay: number;
  checkOutDay: number;
  checkInTime: string;
  foreignAmount: number;
  currency: string;
  exchangeRate: number;
  rateDate: string;
  paymentMethod: string;
  creditCardId?: string | null;
  paymentOwnerName?: string | null;
  splitMemberIds: string[];
  costItemId: string;
};

async function removeCost(client: PoolClient, tripId: string, costItemId: string) {
  const rows = await client.query<{ id: string; cost_items: Array<Record<string, unknown>> }>(
    "SELECT id,cost_items FROM itineraries WHERE trip_id=$1",
    [tripId],
  );
  for (const row of rows.rows) {
    const next = row.cost_items.filter((cost) => cost.id !== costItemId);
    if (next.length !== row.cost_items.length)
      await client.query(
        "UPDATE itineraries SET cost_items=$2::jsonb,updated_at=now() WHERE id=$1",
        [row.id, JSON.stringify(next)],
      );
  }
}

function accommodationCost(input: AccommodationLinkedInput) {
  return {
    id: input.costItemId,
    key: `ค่าที่พัก ${input.name}`,
    value: Math.round(input.foreignAmount * input.exchangeRate * 100) / 100,
    category: "ที่พัก",
    currency: input.currency,
    foreignAmount: input.foreignAmount,
    exchangeRate: input.exchangeRate,
    rateDate: input.rateDate,
    paymentMethod: input.paymentMethod,
    creditCardId: input.creditCardId || undefined,
    paymentOwnerName: input.paymentOwnerName || undefined,
    splitMemberIds: input.splitMemberIds,
  };
}

export async function syncAccommodationLinkedRecords(
  client: PoolClient,
  input: AccommodationLinkedInput,
) {
  const previousDays = await client.query<{ day_number: number }>(
    "SELECT DISTINCT day_number FROM itineraries WHERE trip_id=$1 AND accommodation_id=$2",
    [input.tripId, input.id],
  );
  await removeCost(client, input.tripId, input.costItemId);
  await client.query(
    "DELETE FROM itineraries WHERE trip_id=$1 AND accommodation_id=$2",
    [input.tripId, input.id],
  );

  const nights = input.checkOutDay - input.checkInDay;
  const cost = input.foreignAmount > 0 ? [accommodationCost(input)] : [];
  const affectedDays = previousDays.rows.map((row) => row.day_number);
  for (let night = 1; night <= nights; night += 1) {
    const dayNumber = input.checkInDay + night - 1;
    affectedDays.push(dayNumber);
    await client.query(
      `INSERT INTO itineraries
       (trip_id,day_number,time_slot,start_time,place_name,address,transport_mode,
        transport_note,cost_items,sort_order,accommodation_id,accommodation_night,accommodation_nights)
       VALUES ($1,$2,'evening','23:30',$3,$4,NULL,$5,$6::jsonb,
        COALESCE((SELECT max(sort_order)+1 FROM itineraries WHERE trip_id=$1 AND day_number=$2),0),
        $7,$8,$9)`,
      [
        input.tripId,
        dayNumber,
        input.name,
        input.location || null,
        input.description || null,
        JSON.stringify(night === 1 ? cost : []),
        input.id,
        night,
        nights,
      ],
    );
  }
  await clearFirstItineraryTransport(input.tripId, affectedDays, client);
}

export async function removeAccommodationLinkedRecords(
  client: PoolClient,
  tripId: string,
  accommodationId: string,
  costItemId: string,
) {
  const days = await client.query<{ day_number: number }>(
    "SELECT DISTINCT day_number FROM itineraries WHERE trip_id=$1 AND accommodation_id=$2",
    [tripId, accommodationId],
  );
  await removeCost(client, tripId, costItemId);
  await client.query(
    "DELETE FROM itineraries WHERE trip_id=$1 AND accommodation_id=$2",
    [tripId, accommodationId],
  );
  await clearFirstItineraryTransport(
    tripId,
    days.rows.map((row) => row.day_number),
    client,
  );
}

export async function syncAccommodationCostsFromItineraries(tripId: string) {
  const rows = await query<{
    id: string;
    item: Record<string, unknown> | null;
  }>(
    `SELECT accommodation.id,cost.item
     FROM trip_accommodations accommodation
     LEFT JOIN LATERAL (
       SELECT item
       FROM itineraries itinerary
       CROSS JOIN LATERAL jsonb_array_elements(itinerary.cost_items) item
       WHERE itinerary.trip_id=accommodation.trip_id
         AND item->>'id'=accommodation.cost_item_id::text
       LIMIT 1
     ) cost ON true
     WHERE accommodation.trip_id=$1`,
    [tripId],
  );
  for (const row of rows.rows) {
    const item = row.item;
    if (!item) {
      await query(
        "UPDATE trip_accommodations SET foreign_amount=0,updated_at=now() WHERE id=$1",
        [row.id],
      );
      continue;
    }
    const splitMemberIds = Array.isArray(item.splitMemberIds)
      ? item.splitMemberIds.filter((id): id is string => typeof id === "string")
      : [];
    await query(
      `UPDATE trip_accommodations SET foreign_amount=$2,currency=$3,exchange_rate=$4,
       rate_date=$5,payment_method=$6,credit_card_id=$7,payment_owner_name=$8,
       split_member_ids=$9::uuid[],updated_at=now() WHERE id=$1`,
      [
        row.id,
        Number(item.foreignAmount ?? item.value ?? 0),
        String(item.currency || "THB").slice(0, 3).toUpperCase(),
        Number(item.exchangeRate || 1),
        String(item.rateDate || new Date().toISOString().slice(0, 10)),
        String(item.paymentMethod || "เงินสด"),
        typeof item.creditCardId === "string" ? item.creditCardId : null,
        typeof item.paymentOwnerName === "string" ? item.paymentOwnerName : null,
        splitMemberIds,
      ],
    );
  }
}
