export const OFFLINE_DOCUMENT_CACHE = "bn-trip-private-documents-v1";
export const OFFLINE_DOCUMENTS_CHANGED = "routerao:offline-documents-changed";
export type OfflineDocumentUsage = { count: number; bytes: number };

export function notifyOfflineDocumentsChanged() {
  window.dispatchEvent(new Event(OFFLINE_DOCUMENTS_CHANGED));
}

export async function readOfflineDocumentUsage(storage: CacheStorage): Promise<OfflineDocumentUsage> {
  if (!await storage.has(OFFLINE_DOCUMENT_CACHE)) return { count: 0, bytes: 0 };
  const cache = await storage.open(OFFLINE_DOCUMENT_CACHE);
  let count = 0;
  let bytes = 0;
  // Read one response at a time and stream the body instead of holding every file in memory.
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const reader = response.body?.getReader();
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
        }
      } finally { reader.releaseLock(); }
    }
    count += 1;
  }
  return { count, bytes };
}

export function offlineDocumentMegabytes(bytes: number) {
  return (bytes / 1_000_000).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
