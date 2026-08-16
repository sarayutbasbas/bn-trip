import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";
import { ensureLatestDatabaseSchema } from "@/src/lib/database-migrations";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { logTripActivity } from "@/src/lib/activity";

const reviewSchema = z.object({
  rating: z
    .number()
    .min(1)
    .max(5)
    .refine(Number.isInteger, "Rating must be an integer"),
  review: z.string().trim().max(2000),
});

type ReviewRow = {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: "owner" | "collaborator";
  rating: string | null;
  review: string | null;
  updated_at: string | null;
  is_current_user: boolean;
};

async function listReviews(tripId: string, userId: string) {
  const result = await query<ReviewRow>(
    `WITH trip_members AS (
       SELECT owner.id AS user_id,owner.email,owner.display_name,owner.avatar_url,
         'owner'::text AS role,1 AS sort_order
       FROM trips trip JOIN users owner ON owner.id=trip.owner_id
       WHERE trip.id=$1
       UNION ALL
       SELECT member.id,member.email,member.display_name,member.avatar_url,
         'collaborator'::text,0
       FROM trip_collaborators collaborator
       JOIN users member ON member.id=collaborator.user_id
       WHERE collaborator.trip_id=$1 AND collaborator.user_id IS NOT NULL
     )
     SELECT member.user_id,member.email,member.display_name,member.avatar_url,member.role,
       review.rating::text,review.review,review.updated_at,(member.user_id=$2) AS is_current_user
     FROM trip_members member
     LEFT JOIN trip_reviews review ON review.trip_id=$1 AND review.user_id=member.user_id
     ORDER BY member.sort_order,member.display_name,member.user_id`,
    [tripId, userId],
  );
  const ratings = result.rows
    .map((row) => Number(row.rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
    : 0;
  return { items: result.rows, average, count: ratings.length };
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (session.isDemo) {
    const hasSampleReview = id === "d1000000-0000-4000-8000-000000000003";
    return NextResponse.json({
      items: [
        {
          user_id: session.userId,
          email: session.email,
          display_name: session.displayName,
          avatar_url: session.avatarUrl,
          role: "owner",
          rating: hasSampleReview ? "5.0" : null,
          review: hasSampleReview
            ? "วิวหิมะสวยมาก แผนแต่ละวันกำลังดี และอยากกลับไปอีกครั้ง"
            : null,
          updated_at: hasSampleReview ? new Date().toISOString() : null,
          is_current_user: true,
        },
      ],
      average: hasSampleReview ? 5 : 0,
      count: hasSampleReview ? 1 : 0,
    });
  }
  await ensureLatestDatabaseSchema();
  if (!(await getTripRole(id, session.userId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await listReviews(id, session.userId));
}

export async function PUT(
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
  await ensureLatestDatabaseSchema();
  const { id } = await params;
  if (!(await getTripRole(id, session.userId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "ข้อมูลรีวิวไม่ถูกต้อง" }, { status: 400 });
  const before = await query(
    "SELECT * FROM trip_reviews WHERE trip_id=$1 AND user_id=$2",
    [id, session.userId],
  );
  const saved = await query(
    `INSERT INTO trip_reviews (trip_id,user_id,rating,review)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (trip_id,user_id) DO UPDATE
       SET rating=EXCLUDED.rating,review=EXCLUDED.review,updated_at=now()
     RETURNING *`,
    [id, session.userId, parsed.data.rating, parsed.data.review],
  );
  await logTripActivity({
    tripId: id,
    actorUserId: session.userId,
    entityType: "review",
    entityId: saved.rows[0].id,
    action: before.rows[0] ? "update" : "create",
    summary: before.rows[0] ? "แก้ไขรีวิวทริป" : "เพิ่มรีวิวทริป",
    before: before.rows[0],
    after: saved.rows[0],
  });
  return NextResponse.json(await listReviews(id, session.userId));
}
