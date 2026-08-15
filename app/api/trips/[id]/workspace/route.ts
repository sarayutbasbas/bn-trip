import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";
import { DOCUMENT_QUOTA_BYTES } from "@/src/lib/document-storage";
import { getStorageBackend } from "@/src/lib/storage";
import { ensureDefaultMasterChecklist } from "@/src/lib/checklist-master-defaults";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const requestedTab = new URL(request.url).searchParams.get("tab");
  const tab =
    requestedTab === "documents" || requestedTab === "history"
      ? requestedTab
      : "checklist";
  if (session.isDemo)
    return NextResponse.json({
      ...(tab === "checklist"
        ? { checklist: [], masterCategories: [], masterItems: [] }
        : {}),
      ...(tab === "documents" ? { documents: [] } : {}),
      ...(tab === "history" ? { activities: [] } : {}),
      members: [],
      currentUserId: session.userId,
      role: "collaborator",
      documentUploadMode: "server",
      documentQuotaBytes: DOCUMENT_QUOTA_BYTES,
      documentUsageBytes: 0,
    });
  const role = await getTripRole(id, session.userId);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tab === "checklist")
    await ensureDefaultMasterChecklist(session.userId, session.email);
  const membersPromise = query(
    `SELECT member.id,member.email,member.display_name,member.avatar_url,member.role FROM (
      SELECT owner.id,owner.email,owner.display_name,owner.avatar_url,'owner'::text AS role,1 AS sort_order FROM trips trip JOIN users owner ON owner.id=trip.owner_id WHERE trip.id=$1
      UNION ALL SELECT user_account.id,user_account.email,user_account.display_name,user_account.avatar_url,'collaborator'::text,0 FROM trip_collaborators collaborator JOIN users user_account ON user_account.id=collaborator.user_id WHERE collaborator.trip_id=$1
    ) member ORDER BY member.sort_order,member.display_name`,
    [id],
  );
  const checklistPromise =
    tab === "checklist"
      ? query(
      `SELECT item.*,COALESCE(master_category.name,item.category_name) AS category_name,assignee.display_name AS assigned_name,assignee.avatar_url AS assigned_avatar_url,creator.display_name AS created_by_name,creator.avatar_url AS created_by_avatar_url
      FROM trip_checklist_items item LEFT JOIN checklist_master_items master_item ON master_item.id=item.master_item_id LEFT JOIN checklist_master_categories master_category ON master_category.id=master_item.category_id LEFT JOIN users assignee ON assignee.id=item.assigned_user_id LEFT JOIN users creator ON creator.id=item.created_by
      WHERE item.trip_id=$1 ORDER BY item.sort_order,item.created_at`,
      [id],
    ) : Promise.resolve({ rows: [] });
  const documentsPromise =
    tab === "documents"
      ? query(
      `SELECT document.id,document.trip_id,document.title,document.original_filename,document.mime_type,document.file_size,document.created_at,
      uploader.display_name AS uploaded_by_name
      FROM trip_documents document LEFT JOIN users uploader ON uploader.id=document.uploaded_by
      WHERE document.trip_id=$1 ORDER BY document.created_at DESC`,
      [id],
    ) : Promise.resolve({ rows: [] });
  const activitiesPromise =
    tab === "history"
      ? query(
      `SELECT activity.id,activity.entity_type,activity.entity_id,activity.action,activity.summary,activity.created_at,activity.undone_at,
      (activity.created_at>=now()-interval '180 days' AND activity.rank<=500) AS can_undo,
      actor.display_name AS actor_name,actor.avatar_url AS actor_avatar_url
      FROM (SELECT log.*,ROW_NUMBER() OVER (ORDER BY log.created_at DESC) AS rank FROM trip_activity_logs log WHERE log.trip_id=$1) activity LEFT JOIN users actor ON actor.id=activity.actor_user_id
      WHERE activity.trip_id=$1 ORDER BY activity.created_at DESC LIMIT 60`,
      [id],
    ) : Promise.resolve({ rows: [] });
  const masterCategoriesPromise =
    tab === "checklist"
      ? query(
      "SELECT id,name,sort_order FROM checklist_master_categories WHERE user_id=$1 ORDER BY sort_order,created_at",
      [session.userId],
    ) : Promise.resolve({ rows: [] });
  const masterItemsPromise =
    tab === "checklist"
      ? query(
      "SELECT id,category_id,title,sort_order FROM checklist_master_items WHERE user_id=$1 ORDER BY category_id,sort_order,created_at",
      [session.userId],
    ) : Promise.resolve({ rows: [] });
  const [members, checklist, documents, activities, masterCategories, masterItems] = await Promise.all([
    membersPromise,
    checklistPromise,
    documentsPromise,
    activitiesPromise,
    masterCategoriesPromise,
    masterItemsPromise,
  ]);
  const documentUsageBytes = documents.rows.reduce(
    (total, item) => total + Number((item as { file_size: number }).file_size),
    0,
  );
  return NextResponse.json({
    ...(tab === "checklist"
      ? {
          checklist: checklist.rows,
          masterCategories: masterCategories.rows,
          masterItems: masterItems.rows,
        }
      : {}),
    ...(tab === "documents" ? { documents: documents.rows } : {}),
    ...(tab === "history" ? { activities: activities.rows } : {}),
    members: members.rows,
    currentUserId: session.userId,
    role,
    documentUploadMode: getStorageBackend() === "blob" ? "client" : "server",
    documentQuotaBytes: DOCUMENT_QUOTA_BYTES,
    documentUsageBytes,
  });
}
