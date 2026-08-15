import { randomUUID } from "node:crypto";
import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { logTripActivity } from "@/src/lib/activity";
import { getSession } from "@/src/lib/auth";
import { query, transaction } from "@/src/lib/db";
import {
  DOCUMENT_QUOTA_BYTES,
  documentExtension,
  validateDocument,
} from "@/src/lib/document-storage";
import {
  deleteUpload,
  getStorageBackend,
  saveUpload,
} from "@/src/lib/storage";
import { getTripRole } from "@/src/lib/trip-access";

export const runtime = "nodejs";

type StoredDocument = {
  id: string;
  trip_id: string;
  title: string;
  stored_filename: string;
  blob_url: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
};

async function requireOwner(tripId: string) {
  const session = await getSession();
  if (!session)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.isDemo)
    return {
      error: NextResponse.json(
        { error: "Demo mode is read-only", loginRequired: true },
        { status: 403 },
      ),
    };
  if ((await getTripRole(tripId, session.userId)) !== "owner")
    return {
      error: NextResponse.json(
        { error: "เฉพาะเจ้าของทริปที่แก้ไขเอกสารได้" },
        { status: 403 },
      ),
    };
  return { session };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  const access = await requireOwner(id);
  if (access.error) return access.error;
  const existingResult = await query<StoredDocument>(
    "SELECT * FROM trip_documents WHERE id=$1 AND trip_id=$2 LIMIT 1",
    [documentId, id],
  );
  const existing = existingResult.rows[0];
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let orphan: { filename: string; blobUrl: string | null } | null = null;
  try {
    const isJson = request.headers.get("content-type")?.includes("application/json");
    let title = "";
    let replacement:
      | {
          storedFilename: string;
          blobUrl: string | null;
          originalFilename: string;
          mimeType: string;
          size: number;
        }
      | undefined;

    if (isJson) {
      const body = (await request.json()) as Record<string, unknown>;
      title = String(body.title || "").trim();
      if (body.blobUrl) {
        if (getStorageBackend() !== "blob")
          return NextResponse.json(
            { error: "Client upload is unavailable" },
            { status: 400 },
          );
        const originalFilename = String(body.originalFilename || "").trim();
        const mimeType = String(body.mimeType || "");
        const size = Number(body.size);
        const blobUrl = String(body.blobUrl || "");
        const pathname = String(body.pathname || "");
        const validation = validateDocument(mimeType, size);
        if (
          validation ||
          !originalFilename ||
          !pathname.startsWith(`documents/${id}/`)
        )
          return NextResponse.json(
            { error: validation || "ข้อมูลเอกสารไม่ถูกต้อง" },
            { status: 400 },
          );
        const metadata = await head(blobUrl);
        if (
          metadata.pathname !== pathname ||
          metadata.size !== size ||
          metadata.contentType !== mimeType
        )
          throw new Error("invalid_blob");
        replacement = {
          storedFilename: pathname,
          blobUrl,
          originalFilename,
          mimeType,
          size,
        };
        orphan = { filename: pathname, blobUrl };
      }
    } else {
      if (getStorageBackend() === "blob")
        return NextResponse.json(
          { error: "กรุณาอัปโหลดผ่าน Client Upload" },
          { status: 400 },
        );
      const form = await request.formData();
      title = String(form.get("title") || "").trim();
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const validation = validateDocument(file.type, file.size);
        if (validation)
          return NextResponse.json({ error: validation }, { status: 400 });
        const storedFilename = `doc-${randomUUID()}.${documentExtension(file.type)}`;
        await saveUpload(
          storedFilename,
          Buffer.from(await file.arrayBuffer()),
          file.type,
        );
        replacement = {
          storedFilename,
          blobUrl: null,
          originalFilename: file.name,
          mimeType: file.type,
          size: file.size,
        };
        orphan = { filename: storedFilename, blobUrl: null };
      }
    }

    if (!title || title.length > 180)
      return NextResponse.json(
        { error: "กรุณากรอกชื่อเอกสาร" },
        { status: 400 },
      );

    const updated = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `trip-document-quota:${id}`,
      ]);
      if (replacement) {
        const usage = await client.query<{ used: string }>(
          "SELECT COALESCE(SUM(file_size),0)::text AS used FROM trip_documents WHERE trip_id=$1 AND id<>$2",
          [id, documentId],
        );
        if (Number(usage.rows[0]?.used || 0) + replacement.size > DOCUMENT_QUOTA_BYTES)
          throw new Error("quota_exceeded");
      }
      const result = replacement
        ? await client.query<StoredDocument>(
            `UPDATE trip_documents SET title=$3,stored_filename=$4,blob_url=$5,original_filename=$6,mime_type=$7,file_size=$8
             WHERE id=$1 AND trip_id=$2 RETURNING *`,
            [
              documentId,
              id,
              title,
              replacement.storedFilename,
              replacement.blobUrl,
              replacement.originalFilename,
              replacement.mimeType,
              replacement.size,
            ],
          )
        : await client.query<StoredDocument>(
            "UPDATE trip_documents SET title=$3 WHERE id=$1 AND trip_id=$2 RETURNING *",
            [documentId, id, title],
          );
      return result.rows[0];
    });
    orphan = null;
    if (replacement)
      await deleteUpload(existing.stored_filename, existing.blob_url).catch(
        () => undefined,
      );
    await logTripActivity({
      tripId: id,
      actorUserId: access.session!.userId,
      entityType: "document",
      entityId: documentId,
      action: "update",
      summary: `แก้ไขเอกสาร “${title}”`,
      before: existing,
      after: updated,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (orphan)
      await deleteUpload(orphan.filename, orphan.blobUrl).catch(() => undefined);
    if (error instanceof Error && error.message === "quota_exceeded")
      return NextResponse.json(
        { error: "พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)" },
        { status: 413 },
      );
    console.error("Document update error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "invalid_blob"
            ? "ตรวจสอบไฟล์ที่อัปโหลดไม่สำเร็จ"
            : "แก้ไขเอกสารไม่สำเร็จ",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  const access = await requireOwner(id);
  if (access.error) return access.error;
  const result = await query<StoredDocument>(
    "DELETE FROM trip_documents WHERE id=$1 AND trip_id=$2 RETURNING *",
    [documentId, id],
  );
  if (!result.rowCount)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteUpload(result.rows[0].stored_filename, result.rows[0].blob_url);
  await logTripActivity({
    tripId: id,
    actorUserId: access.session!.userId,
    entityType: "document",
    entityId: documentId,
    action: "delete",
    summary: `ลบเอกสาร “${result.rows[0].title}”`,
    before: result.rows[0],
  });
  return NextResponse.json({ ok: true });
}
