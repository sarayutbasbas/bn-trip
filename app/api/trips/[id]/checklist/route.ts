import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { query, transaction } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";

const schema = z.union([
  z.object({ masterItemIds: z.array(z.string().uuid()).min(1).max(200) }),
  z.object({
    title: z.string().trim().min(1).max(240),
    categoryId: z.string().uuid(),
    assignedUserId: z.string().uuid().nullable().optional(),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
    const { id } = await params;
    if (!(await getTripRole(id, session.userId)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input = schema.parse(await request.json());
    if ("masterItemIds" in input) {
      const rows = await transaction(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `trip-checklist:${id}`,
        ]);
        const masters = await client.query<{
          id: string;
          title: string;
          category_name: string;
        }>(
          `SELECT item.id,item.title,category.name AS category_name FROM checklist_master_items item JOIN checklist_master_categories category ON category.id=item.category_id WHERE item.user_id=$1 AND item.id=ANY($2::uuid[]) ORDER BY category.sort_order,item.sort_order`,
          [session.userId, input.masterItemIds],
        );
        const inserted = [];
        for (const master of masters.rows) {
          const result = await client.query(
            `INSERT INTO trip_checklist_items (trip_id,title,master_item_id,category_name,sort_order,created_by)
          VALUES ($1,$2,$3,$4,COALESCE((SELECT max(sort_order)+1 FROM trip_checklist_items WHERE trip_id=$1),0),$5)
          ON CONFLICT (trip_id,master_item_id) WHERE master_item_id IS NOT NULL DO NOTHING RETURNING *`,
            [id, master.title, master.id, master.category_name, session.userId],
          );
          if (result.rows[0]) inserted.push(result.rows[0]);
        }
        return inserted;
      });
      for (const item of rows)
        await logTripActivity({
          tripId: id,
          actorUserId: session.userId,
          entityType: "checklist",
          entityId: item.id,
          action: "create",
          summary: `เพิ่ม Checklist “${item.title}” จาก Master`,
          after: item,
        });
      return NextResponse.json({ items: rows }, { status: 201 });
    }
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
    const result = await transaction(async (client) => {
      const category = await client.query<{ name: string }>(
        "SELECT name FROM checklist_master_categories WHERE id=$1 AND user_id=$2",
        [input.categoryId, session.userId],
      );
      if (!category.rowCount) throw new Error("category_not_found");
      let master = await client.query<{ id: string }>(
        "SELECT id FROM checklist_master_items WHERE user_id=$1 AND category_id=$2 AND lower(title)=lower($3)",
        [session.userId, input.categoryId, input.title],
      );
      if (!master.rowCount)
        master = await client.query<{ id: string }>(
          `INSERT INTO checklist_master_items (user_id,category_id,title,sort_order) VALUES ($1,$2,$3,COALESCE((SELECT max(sort_order)+1 FROM checklist_master_items WHERE category_id=$2),0)) RETURNING id`,
          [session.userId, input.categoryId, input.title],
        );
      const inserted = await client.query(
        `INSERT INTO trip_checklist_items (trip_id,title,master_item_id,category_name,assigned_user_id,sort_order,created_by)
        VALUES ($1,$2,$3,$4,$5,COALESCE((SELECT max(sort_order)+1 FROM trip_checklist_items WHERE trip_id=$1),0),$6)
        ON CONFLICT (trip_id,master_item_id) WHERE master_item_id IS NOT NULL DO NOTHING RETURNING *`,
        [
          id,
          input.title,
          master.rows[0].id,
          category.rows[0].name,
          input.assignedUserId || null,
          session.userId,
        ],
      );
      return inserted.rows[0];
    });
    if (!result)
      return NextResponse.json(
        { error: "รายการนี้อยู่ในทริปแล้ว" },
        { status: 409 },
      );
    await logTripActivity({
      tripId: id,
      actorUserId: session.userId,
      entityType: "checklist",
      entityId: result.id,
      action: "create",
      summary: `เพิ่ม Checklist “${input.title}”`,
      after: result,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "category_not_found"
            ? "ไม่พบหมวดหมู่"
            : "ข้อมูล Checklist ไม่ถูกต้อง",
      },
      { status: 400 },
    );
  }
}

const deleteCategorySchema = z.object({
  categoryName: z.string().trim().min(1).max(120),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
    const { id } = await params;
    if (!(await getTripRole(id, session.userId)))
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { categoryName } = deleteCategorySchema.parse(await request.json());
    const removed = await transaction(async (client) => {
      const matches = await client.query(
        `SELECT item.* FROM trip_checklist_items item LEFT JOIN checklist_master_items master_item ON master_item.id=item.master_item_id LEFT JOIN checklist_master_categories master_category ON master_category.id=master_item.category_id WHERE item.trip_id=$1 AND item.created_by=$2 AND COALESCE(master_category.name,item.category_name)=$3 FOR UPDATE OF item`,
        [id, session.userId, categoryName],
      );
      if (!matches.rowCount) return [];
      await client.query(
        "DELETE FROM trip_checklist_items WHERE id=ANY($1::uuid[])",
        [matches.rows.map((item) => item.id)],
      );
      return matches.rows;
    });
    if (!removed.length)
      return NextResponse.json(
        { error: "ไม่พบรายการที่คุณลบได้ในหมวดนี้" },
        { status: 404 },
      );
    await logTripActivity({
      tripId: id,
      actorUserId: session.userId,
      entityType: "checklist_category",
      action: "delete",
      summary: `ลบ Checklist หมวด “${categoryName}” ${removed.length} รายการ`,
      before: removed,
    });
    return NextResponse.json({ ok: true, count: removed.length });
  } catch {
    return NextResponse.json(
      { error: "ข้อมูลหมวด Checklist ไม่ถูกต้อง" },
      { status: 400 },
    );
  }
}
