import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocumentViewerPage } from "@/src/components/document-viewer-page";
import { getSession } from "@/src/lib/auth";
import { query } from "@/src/lib/db";
import { getTripRole } from "@/src/lib/trip-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เอกสารทริป" };

export default async function TripDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id, documentId } = await params;
  if (!(await getTripRole(id, session.userId))) notFound();

  const result = await query<{
    title: string;
    original_filename: string;
    mime_type: string;
  }>(
    "SELECT title, original_filename, mime_type FROM trip_documents WHERE id=$1 AND trip_id=$2 LIMIT 1",
    [documentId, id],
  );
  const document = result.rows[0];
  if (!document) notFound();

  return (
    <DocumentViewerPage
      tripId={id}
      documentId={documentId}
      title={document.title}
      filename={document.original_filename}
      mimeType={document.mime_type}
    />
  );
}
