import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

export type StorageBackend = "local" | "blob";

const uploadDir = process.env.UPLOAD_DIR ?? "/tmp/bn-trip-uploads";

export function getStorageBackend(): StorageBackend {
  const configured = process.env.STORAGE_BACKEND;
  if (configured === "local" || configured === "blob") return configured;
  return process.env.VERCEL ? "blob" : "local";
}

function requireBlobCredentials() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error("BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN is required when STORAGE_BACKEND=blob");
  }
}

function blobPath(filename: string) {
  return `uploads/${filename}`;
}

export async function saveUpload(filename: string, data: Buffer, contentType: string) {
  if (getStorageBackend() === "blob") {
    requireBlobCredentials();
    await put(blobPath(filename), data, {
      access: "private",
      addRandomSuffix: false,
      contentType,
    });
  } else {
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), data);
  }

  // Keep one stable URL shape in the database for both local files and cloud blobs.
  return `/api/uploads/${filename}`;
}

export async function readUpload(filename: string, ifNoneMatch?: string) {
  if (getStorageBackend() === "blob") {
    requireBlobCredentials();
    const result = await get(blobPath(filename), {
      access: "private",
      ifNoneMatch,
    });

    if (!result) return null;
    return {
      statusCode: result.statusCode,
      body: result.stream,
      contentType: result.blob.contentType,
      etag: result.blob.etag,
    };
  }

  try {
    return {
      statusCode: 200,
      body: await readFile(path.join(uploadDir, filename)),
      contentType: undefined,
      etag: undefined,
    };
  } catch {
    return null;
  }
}
