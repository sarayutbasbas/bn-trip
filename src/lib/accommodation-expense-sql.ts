// Match by the linked expense ID even when the cost was moved to another
// timeline row. Older bookings also match the generated title on their row.
export const accommodationCostMatchSql = (cost = "cost.item", itinerary = "i", accommodation = "payment_accommodation") => `(
  ${accommodation}.cost_item_id::text=${cost}->>'id'
  OR (${accommodation}.id=${itinerary}.accommodation_id AND ${cost}->>'category'='ที่พัก'
    AND ${cost}->>'key'=('ค่าที่พัก '||${accommodation}.name))
)`;

export const accommodationUnpaidSql = (alias = "payment_accommodation") => `(
  ${alias}.payment_date > (now() AT TIME ZONE 'Asia/Bangkok')::date
  OR (${alias}.payment_date IS NULL AND ${alias}.payment_status='pending')
)`;

// Enrich responses from the authoritative booking; do not copy a derived paid
// flag into stored JSON, where it would become stale when the due date arrives.
export const accommodationExpenseItemsExpression = (itinerary = "i") => `COALESCE((
  SELECT jsonb_agg((payment_cost.item-'accommodationPaymentDate'-'accommodationPaymentStatus') ||
    CASE WHEN payment_accommodation.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'accommodationPaymentDate',payment_accommodation.payment_date::text,
      'accommodationPaymentStatus',payment_accommodation.payment_status
    ) END ORDER BY payment_cost.position)
  FROM jsonb_array_elements(COALESCE(${itinerary}.cost_items,'[]'::jsonb)) WITH ORDINALITY AS payment_cost(item,position)
  LEFT JOIN LATERAL (
    SELECT booking.id,booking.payment_date,booking.payment_status FROM trip_accommodations booking
    WHERE booking.trip_id=${itinerary}.trip_id AND ${accommodationCostMatchSql("payment_cost.item",itinerary,"booking")}
    ORDER BY CASE WHEN booking.cost_item_id::text=payment_cost.item->>'id' THEN 0 ELSE 1 END,booking.id LIMIT 1
  ) payment_accommodation ON true
),'[]'::jsonb)`;
export const accommodationExpenseItemsSql = (itinerary = "i") => `${accommodationExpenseItemsExpression(itinerary)} AS cost_items`;
