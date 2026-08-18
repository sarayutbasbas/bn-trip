import type { PoolClient } from "pg";

type LinkedFlightInput = {
  tripId: string;
  segmentId: string;
  flightLabel: string;
  airlineName: string;
  departureAirportCode: string;
  departureAirportName: string;
  arrivalAirportCode: string;
  arrivalAirportName: string;
  scheduledDepartureAt: string;
  enteredDepartureLocal: string;
  departureTerminal?: string | null;
  departureGate?: string | null;
  ticketPrice: number;
  ticketCurrency: string;
  ticketExchangeRate: number;
  ticketRateDate: string;
  passengerIds: string[];
  itineraryId?: string | null;
  ticketCostItemId?: string | null;
};

type TimelinePosition = {
  day_number: number;
  start_time: string;
  time_slot: "morning" | "afternoon" | "evening";
};

async function timelinePosition(client: PoolClient, tripId: string, enteredDepartureLocal: string) {
  const result = await client.query<TimelinePosition>(`SELECT
    GREATEST(1, LEAST(total_days, ($2::timestamp::date - start_date) + 1))::int AS day_number,
    to_char($2::timestamp, 'HH24:MI') AS start_time,
    CASE
      WHEN EXTRACT(HOUR FROM $2::timestamp) < 12 THEN 'morning'
      WHEN EXTRACT(HOUR FROM $2::timestamp) < 17 THEN 'afternoon'
      ELSE 'evening'
    END AS time_slot
    FROM trips WHERE id=$1`, [tripId, enteredDepartureLocal]);
  if (!result.rows[0]) throw new Error("trip_not_found");
  return result.rows[0];
}

function timelineCopy(input: LinkedFlightInput) {
  const airportRoute = [input.departureAirportName || input.departureAirportCode, input.arrivalAirportName || input.arrivalAirportCode].join(" → ");
  const terminal = input.departureTerminal ? `Terminal ${input.departureTerminal}` : "Terminal รออัปเดต";
  const gate = input.departureGate ? `Gate ${input.departureGate}` : "Gate รออัปเดต";
  return {
    placeName: `เที่ยวบิน ${input.flightLabel} · ${input.departureAirportCode} → ${input.arrivalAirportCode}`,
    address: airportRoute,
    transportNote: `${input.airlineName || input.flightLabel} · ${terminal} · ${gate}`,
  };
}

function ticketCost(input: LinkedFlightInput, costId: string) {
  return {
    id: costId,
    key: `ตั๋วเครื่องบิน ${input.flightLabel}`,
    value: Math.round(input.ticketPrice * input.ticketExchangeRate * 100) / 100,
    category: "ค่าตั๋วเครื่องบิน",
    currency: input.ticketCurrency,
    foreignAmount: input.ticketPrice,
    exchangeRate: input.ticketExchangeRate,
    rateDate: input.ticketRateDate,
    paymentMethod: "เงินสด",
    splitMemberIds: input.passengerIds,
  };
}

async function removeCostFromItineraries(client: PoolClient, tripId: string, costId: string) {
  const rows = await client.query<{ id: string; cost_items: Array<Record<string, unknown>> }>("SELECT id,cost_items FROM itineraries WHERE trip_id=$1", [tripId]);
  for (const row of rows.rows) {
    const costs = row.cost_items.filter((item) => item.id !== costId);
    if (costs.length !== row.cost_items.length) await client.query("UPDATE itineraries SET cost_items=$2::jsonb,updated_at=now() WHERE id=$1", [row.id, JSON.stringify(costs)]);
  }
}

export async function syncFlightLinkedRecords(client: PoolClient, input: LinkedFlightInput) {
  const position = await timelinePosition(client, input.tripId, input.enteredDepartureLocal);
  const copy = timelineCopy(input);
  let itineraryId = input.itineraryId || null;
  if (itineraryId) {
    const updated = await client.query<{ id: string }>(`UPDATE itineraries SET
      day_number=$3,time_slot=$4,start_time=$5::time,place_name=$6,address=$7,
      transport_mode='เครื่องบิน',transport_note=$8,updated_at=now()
      WHERE id=$1 AND trip_id=$2 RETURNING id`, [itineraryId, input.tripId, position.day_number, position.time_slot, position.start_time, copy.placeName, copy.address, copy.transportNote]);
    if (!updated.rowCount) itineraryId = null;
  }
  if (!itineraryId) {
    const created = await client.query<{ id: string }>(`INSERT INTO itineraries
      (trip_id,day_number,time_slot,start_time,place_name,address,transport_mode,transport_note,cost_items,sort_order)
      VALUES ($1,$2,$3,$4::time,$5,$6,'เครื่องบิน',$7,'[]'::jsonb,
        COALESCE((SELECT max(sort_order)+1 FROM itineraries WHERE trip_id=$1 AND day_number=$2),0))
      RETURNING id`, [input.tripId, position.day_number, position.time_slot, position.start_time, copy.placeName, copy.address, copy.transportNote]);
    itineraryId = created.rows[0].id;
  }

  if (input.ticketPrice <= 0) {
    if (input.ticketCostItemId) await removeCostFromItineraries(client, input.tripId, input.ticketCostItemId);
    await client.query(`UPDATE trip_flight_segments SET itinerary_id=$2,ticket_cost_item_id=NULL,
      ticket_price=NULL,ticket_currency=NULL,ticket_exchange_rate=NULL,ticket_rate_date=NULL,updated_at=now()
      WHERE id=$1`, [input.segmentId, itineraryId]);
    return { itineraryId, costId: null };
  }

  const costIdResult = input.ticketCostItemId
    ? { rows: [{ id: input.ticketCostItemId }] }
    : await client.query<{ id: string }>("SELECT gen_random_uuid() AS id");
  const costId = costIdResult.rows[0].id;

  const cost = ticketCost(input, costId);
  const existingCost = await client.query<{ id: string; cost_items: Array<Record<string, unknown>> }>(`SELECT id,cost_items
    FROM itineraries
    WHERE trip_id=$1 AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(cost_items) item WHERE item->>'id'=$2
    ) LIMIT 1`, [input.tripId, costId]);
  if (existingCost.rows[0]) {
    const row = existingCost.rows[0];
    const costs = row.cost_items.map((item) => item.id === costId ? cost : item);
    await client.query("UPDATE itineraries SET cost_items=$2::jsonb,updated_at=now() WHERE id=$1", [row.id, JSON.stringify(costs)]);
  } else {
    await client.query("UPDATE itineraries SET cost_items=cost_items || $2::jsonb,updated_at=now() WHERE id=$1", [itineraryId, JSON.stringify([cost])]);
  }
  await client.query(`UPDATE trip_flight_segments SET itinerary_id=$2,ticket_cost_item_id=$3,
    ticket_price=$4,ticket_currency=$5,ticket_exchange_rate=$6,ticket_rate_date=$7,updated_at=now()
    WHERE id=$1`, [input.segmentId, itineraryId, costId, input.ticketPrice, input.ticketCurrency, input.ticketExchangeRate, input.ticketRateDate]);
  return { itineraryId, costId };
}

export async function removeFlightLinkedRecords(client: PoolClient, tripId: string, itineraryId: string | null, costId: string | null) {
  if (costId) await removeCostFromItineraries(client, tripId, costId);
  if (itineraryId) await client.query("DELETE FROM itineraries WHERE id=$1 AND trip_id=$2", [itineraryId, tripId]);
}

export async function removeAllFlightRecords(client: PoolClient, tripId: string) {
  const segments = await client.query<{
    itinerary_id: string | null;
    ticket_cost_item_id: string | null;
  }>(
    "SELECT itinerary_id,ticket_cost_item_id FROM trip_flight_segments WHERE trip_id=$1",
    [tripId],
  );
  const itineraryIds = segments.rows.flatMap((segment) =>
    segment.itinerary_id ? [segment.itinerary_id] : [],
  );
  const affectedDays = itineraryIds.length
    ? await client.query<{ day_number: number }>(
        "SELECT DISTINCT day_number FROM itineraries WHERE trip_id=$1 AND id=ANY($2::uuid[])",
        [tripId, itineraryIds],
      )
    : { rows: [] as Array<{ day_number: number }> };
  for (const segment of segments.rows)
    await removeFlightLinkedRecords(
      client,
      tripId,
      segment.itinerary_id,
      segment.ticket_cost_item_id,
    );
  const insuranceDocuments = await client.query<{
    stored_filename: string;
    blob_url: string | null;
  }>(`SELECT DISTINCT document.stored_filename,document.blob_url
    FROM trip_travel_insurance_documents insurance_document
    JOIN trip_documents document ON document.id=insurance_document.document_id
    WHERE insurance_document.trip_id=$1`, [tripId]);
  await client.query(`DELETE FROM trip_documents document USING trip_travel_insurance_documents insurance_document
    WHERE insurance_document.trip_id=$1 AND document.id=insurance_document.document_id`, [tripId]);
  await client.query("DELETE FROM trip_travel_insurance WHERE trip_id=$1", [tripId]);
  await client.query("DELETE FROM trip_flight_segments WHERE trip_id=$1", [tripId]);
  return {
    affectedDays: affectedDays.rows.map((row) => row.day_number),
    insuranceDocuments: insuranceDocuments.rows,
  };
}
