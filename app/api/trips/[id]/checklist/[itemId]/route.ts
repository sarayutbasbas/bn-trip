import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query, transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";

const schema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  categoryId: z.string().uuid().optional(),
  categoryName: z.string().trim().min(1).max(120).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  completed: z.boolean().optional(),
});

type ChecklistRow = {
  id: string;
  title: string;
  created_by: string;
  master_item_id: string | null;
  [key: string]: unknown;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo)
    return NextResponse.json(
      { error: "Demo mode is read-only", loginRequired: true },
      { status: 403 },
    );
  try {
    const { id, itemId } = await params;
    if (!(await getTripRole(id, session.userId)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = schema.parse(await request.json());
    const before = await query<ChecklistRow>(
      "SELECT * FROM trip_checklist_items WHERE id=$1 AND trip_id=$2",
      [itemId, id],
    );
    if (!before.rowCount)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (input.assignedUserId) {
      const member = await query(
        `SELECT 1 FROM trips trip WHERE trip.id=$1 AND (trip.owner_id=$2 OR EXISTS(SELECT 1 FROM trip_collaborators c WHERE c.trip_id=trip.id AND c.user_id=$2))`,
        [id, input.assignedUserId],
      );
      if (!member.rowCount)
        return NextResponse.json(
          { error: "ผู้รับผิดชอบไม่ได้อยู่ในทริปนี้" },
          { status: 400 },
        );
    }
    const updated = await transaction(async (client) => {
      let personalCategoryId = input.categoryId || null;
      let categoryName = input.categoryName || null;
      if (input.categoryId) {
        const personalCategory = await client.query<{ name: string }>(
          "SELECT name FROM checklist_master_categories WHERE id=$1 AND user_id=$2",
          [input.categoryId, session.userId],
        );
        if (!personalCategory.rowCount) throw new Error("category_not_found");
        categoryName = personalCategory.rows[0].name;
      }
      const shouldSyncPersonalMaster =
        Boolean(before.rows[0].master_item_id) &&
        before.rows[0].created_by === session.userId;
      if (input.categoryName && shouldSyncPersonalMaster) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `master-category:${session.userId}:${input.categoryName.toLocaleLowerCase()}`,
        ]);
        let personalCategory = await client.query<{ id: string; name: string }>(
          "SELECT id,name FROM checklist_master_categories WHERE user_id=$1 AND lower(name)=lower($2)",
          [session.userId, input.categoryName],
        );
        if (!personalCategory.rowCount)
          personalCategory = await client.query<{ id: string; name: string }>(
            `INSERT INTO checklist_master_categories (user_id,name,sort_order)
             VALUES ($1,$2,COALESCE((SELECT max(sort_order)+1 FROM checklist_master_categories WHERE user_id=$1),0))
             RETURNING id,name`,
            [session.userId, input.categoryName],
          );
        personalCategoryId = personalCategory.rows[0].id;
        categoryName = personalCategory.rows[0].name;
      }
      const result = await client.query<ChecklistRow>(
        `UPDATE trip_checklist_items SET title=COALESCE($1,title),category_name=COALESCE($2,category_name),
        assigned_user_id=CASE WHEN $3 THEN $4::uuid ELSE assigned_user_id END,
        completed_at=CASE WHEN $5::boolean IS NULL THEN completed_at WHEN $5 THEN now() ELSE NULL END,
        completed_by=CASE WHEN $5::boolean IS NULL THEN completed_by WHEN $5 THEN $6::uuid ELSE NULL END,
        master_item_id=CASE WHEN $9 THEN NULL ELSE master_item_id END,updated_at=now()
        WHERE id=$7 AND trip_id=$8 RETURNING *`,
        [
          input.title || null,
          categoryName,
          Object.prototype.hasOwnProperty.call(input, "assignedUserId"),
          input.assignedUserId || null,
          input.completed ?? null,
          session.userId,
          itemId,
          id,
          Boolean(categoryName) && !shouldSyncPersonalMaster,
        ],
      );
      if ((input.title || categoryName) && shouldSyncPersonalMaster) {
        await client.query(
          `UPDATE checklist_master_items SET title=COALESCE($1,title),category_id=COALESCE($2::uuid,category_id),updated_at=now()
           WHERE id=$3 AND user_id=$4`,
          [
            input.title || null,
            personalCategoryId,
            before.rows[0].master_item_id,
            session.userId,
          ],
        );
      }
      return result.rows[0];
    });
    await logTripActivity({
      tripId: id,
      actorUserId: session.userId,
      entityType: "checklist",
      entityId: itemId,
      action: "update",
      summary: `แก้ไข Checklist “${updated.title}”`,
      before: before.rows[0],
      after: updated,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "ข้อมูล Checklist ไม่ถูกต้อง" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isDemo)
    return NextResponse.json(
      { error: "Demo mode is read-only", loginRequired: true },
      { status: 403 },
    );
  const { id, itemId } = await params;
  if (!(await getTripRole(id, session.userId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await query(
    "DELETE FROM trip_checklist_items WHERE id=$1 AND trip_id=$2 RETURNING *",
    [itemId, id],
  );
  if (!result.rowCount)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logTripActivity({
    tripId: id,
    actorUserId: session.userId,
    entityType: "checklist",
    entityId: itemId,
    action: "delete",
    summary: `ลบ Checklist “${result.rows[0].title}”`,
    before: result.rows[0],
  });
  return NextResponse.json({ ok: true });
}
