import type { PoolClient } from "pg";

type StoredCost = Record<string, unknown> & {
  splitMemberIds?: unknown;
  splitGuestIds?: unknown;
  splitCount?: unknown;
  creditCardId?: unknown;
};

const stringIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export function removeMemberFromCost(
  cost: StoredCost,
  userId: string,
  ownerId: string,
  cardIds: ReadonlySet<string>,
): { cost: StoredCost; changed: boolean } {
  const memberIds = stringIds(cost.splitMemberIds);
  const hadMember = memberIds.includes(userId);
  const removedCard = typeof cost.creditCardId === "string" && cardIds.has(cost.creditCardId);
  const hadSavedSplitCount = cost.splitCount !== undefined;
  if (!hadMember && !removedCard && !hadSavedSplitCount) return { cost, changed: false };

  const next: StoredCost = { ...cost };
  delete next.splitCount;
  if (hadMember) {
    const remaining = memberIds.filter((memberId) => memberId !== userId);
    next.splitMemberIds = remaining.length || stringIds(cost.splitGuestIds).length
      ? remaining
      : [ownerId];
  }
  if (removedCard) {
    delete next.creditCardId;
    delete next.paymentOwnerName;
    next.paymentMethod = "เงินสด";
  }
  return { cost: next, changed: true };
}

export async function clearRemovedTripMember(
  client: PoolClient,
  tripId: string,
  userId: string,
) {
  const trip = await client.query<{ owner_id: string }>(
    "SELECT owner_id FROM trips WHERE id=$1 FOR UPDATE",
    [tripId],
  );
  const ownerId = trip.rows[0]?.owner_id;
  if (!ownerId) throw new Error("trip_not_found");

  const insuranceDocuments = await client.query<{
    id: string;
    stored_filename: string;
    blob_url: string | null;
  }>(
    `SELECT DISTINCT document.id,document.stored_filename,document.blob_url
     FROM trip_travel_insurance_policies policy
     JOIN trip_travel_insurance_documents insurance_document ON insurance_document.policy_id=policy.id
     JOIN trip_documents document ON document.id=insurance_document.document_id
     WHERE policy.trip_id=$1 AND policy.user_id=$2`,
    [tripId, userId],
  );
  if (insuranceDocuments.rows.length) {
    await client.query(
      "DELETE FROM trip_documents WHERE trip_id=$1 AND id=ANY($2::uuid[])",
      [tripId, insuranceDocuments.rows.map((document) => document.id)],
    );
  }
  await client.query(
    "DELETE FROM trip_travel_insurance_policies WHERE trip_id=$1 AND user_id=$2",
    [tripId, userId],
  );
  await client.query(
    "DELETE FROM trip_travel_insurance_passengers WHERE trip_id=$1 AND user_id=$2",
    [tripId, userId],
  );

  await client.query(
    `UPDATE trip_checklist_items SET
       assigned_user_id=CASE WHEN assigned_user_id=$2 THEN NULL ELSE assigned_user_id END,
       completed_by=CASE WHEN completed_by=$2 THEN NULL ELSE completed_by END,
       updated_at=now()
     WHERE trip_id=$1 AND (assigned_user_id=$2 OR completed_by=$2)`,
    [tripId, userId],
  );
  await client.query(
    `DELETE FROM trip_flight_passengers passenger USING trip_flight_segments segment
     WHERE passenger.segment_id=segment.id AND segment.trip_id=$1 AND passenger.user_id=$2`,
    [tripId, userId],
  );
  await client.query(
    `UPDATE trip_accommodations SET
       split_member_ids=CASE
         WHEN cardinality(array_remove(split_member_ids,$2::uuid))=0 THEN ARRAY[$3::uuid]
         ELSE array_remove(split_member_ids,$2::uuid)
       END,
       updated_at=now()
     WHERE trip_id=$1 AND $2::uuid=ANY(split_member_ids)`,
    [tripId, userId, ownerId],
  );

  const cards = await client.query<{ id: string }>(
    "SELECT id FROM credit_cards WHERE user_id=$1",
    [userId],
  );
  const cardIds = new Set(cards.rows.map((card) => card.id));
  if (cardIds.size) {
    await client.query(
      `UPDATE trip_accommodations SET credit_card_id=NULL,payment_owner_name=NULL,
         payment_method='เงินสด',updated_at=now()
       WHERE trip_id=$1 AND credit_card_id=ANY($2::uuid[])`,
      [tripId, [...cardIds]],
    );
  }

  const itineraries = await client.query<{ id: string; cost_items: StoredCost[] }>(
    "SELECT id,cost_items FROM itineraries WHERE trip_id=$1 FOR UPDATE",
    [tripId],
  );
  for (const itinerary of itineraries.rows) {
    let changed = false;
    const costs = itinerary.cost_items.map((cost) => {
      const result = removeMemberFromCost(cost, userId, ownerId, cardIds);
      changed ||= result.changed;
      return result.cost;
    });
    if (changed) {
      await client.query(
        "UPDATE itineraries SET cost_items=$2::jsonb,updated_at=now() WHERE id=$1",
        [itinerary.id, JSON.stringify(costs)],
      );
    }
  }

  await client.query(
    "DELETE FROM trip_reviews WHERE trip_id=$1 AND user_id=$2",
    [tripId, userId],
  );
  return { insuranceDocuments: insuranceDocuments.rows };
}
