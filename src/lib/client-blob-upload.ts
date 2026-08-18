"use client";

type UploadedBlob = {
  url: string;
  pathname: string;
};

export async function uploadPrivateDocument({
  tripId,
  pathname,
  file,
  replaceDocumentId,
}: {
  tripId: string;
  pathname: string;
  file: File;
  replaceDocumentId?: string;
}): Promise<UploadedBlob> {
  const tokenResponse = await fetch(
    `/api/trips/${tripId}/documents/client-upload`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pathname,
        mimeType: file.type,
        size: file.size,
        replaceDocumentId,
      }),
    },
  );
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok)
    throw new Error(tokenBody.error || "เริ่มอัปโหลดไม่สำเร็จ");

  const uploadResponse = await fetch(tokenBody.presignedUrl, {
    method: "PUT",
    headers: {
      "x-vercel-blob-access": "private",
      "x-content-type": file.type,
    },
    body: file,
  });
  const uploadBody = await uploadResponse.json();
  if (!uploadResponse.ok)
    throw new Error(uploadBody.error?.message || "อัปโหลดไฟล์ไม่สำเร็จ");
  return uploadBody as UploadedBlob;
}
