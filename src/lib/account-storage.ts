export type AccountStorageRow = {
  id: string; displayName: string; email: string | null;
  tripCount: number; ideaCount: number; dataBytes: number;
  fileBytes: number | null; fileCount: number; missingFileCount: number;
};
export type StorageInventory = {
  files: Map<string, number>; complete: boolean; available: boolean;
  backend: "local" | "blob";
};
export type AccountStorageReport = {
  accounts: AccountStorageRow[];
  totals: { accounts: number; trips: number; ideas: number; dataBytes: number; fileBytes: number | null; fileCount: number; unmatchedBytes: number | null; unmatchedCount: number; sharedFileCount: number };
  inventory: { backend: "local" | "blob"; complete: boolean; available: boolean };
  updatedAt: string;
};

/** Only paths in our inventory can contribute bytes; never fetch arbitrary URLs. */
export function fileStorageKey(value: string | null): string | null {
  if (!value) return null;
  try {
    if (value.startsWith("/api/uploads/")) return `uploads/${decodeURIComponent(value.slice(13))}`;
    if (/^https?:/.test(value)) {
      const url = new URL(value);
      if (!url.hostname.endsWith(".blob.vercel-storage.com")) return null;
      return decodeURIComponent(url.pathname.slice(1));
    }
    if (value.startsWith("documents/") || value.startsWith("uploads/")) return value;
    // Legacy document records store just the local/upload filename.
    if (/^(?:doc-)?[a-f0-9-]+\.(?:pdf|jpg|png|webp)$/.test(value)) return `uploads/${value}`;
  } catch { /* Invalid/external URLs are not hosted files. */ }
  return null;
}

export function accountStorageReport(
  accounts: Omit<AccountStorageRow, "fileBytes" | "fileCount" | "missingFileCount">[],
  references: { ownerId: string; url: string | null }[],
  inventory: StorageInventory,
): AccountStorageReport {
  const accountFiles = new Map<string, Set<string>>();
  for (const ref of references) {
    const key = fileStorageKey(ref.url);
    if (!key) continue;
    const keys = accountFiles.get(ref.ownerId) || new Set<string>();
    keys.add(key); accountFiles.set(ref.ownerId, keys);
  }
  const matched = new Map<string, number>();
  const rows = accounts.map(account => {
    let fileBytes = 0, fileCount = 0, missingFileCount = 0;
    for (const key of accountFiles.get(account.id) || []) {
      const size = inventory.files.get(key);
      if (size === undefined) { missingFileCount++; continue; }
      fileBytes += size; fileCount++;
      matched.set(key, (matched.get(key) || 0) + 1);
    }
    return { ...account, fileBytes: inventory.available ? fileBytes : null, fileCount, missingFileCount };
  }).sort((a, b) => ((b.fileBytes || 0) + b.dataBytes) - ((a.fileBytes || 0) + a.dataBytes));
  let fileBytes = 0, unmatchedBytes = 0, unmatchedCount = 0;
  for (const [key, size] of inventory.files) {
    fileBytes += size;
    if (!matched.has(key)) { unmatchedBytes += size; unmatchedCount++; }
  }
  return {
    accounts: rows,
    totals: {
      accounts: rows.length, trips: rows.reduce((sum, a) => sum + a.tripCount, 0), ideas: rows.reduce((sum, a) => sum + a.ideaCount, 0),
      dataBytes: rows.reduce((sum, a) => sum + a.dataBytes, 0), fileBytes: inventory.available ? fileBytes : null,
      fileCount: inventory.files.size, unmatchedBytes: inventory.available ? unmatchedBytes : null, unmatchedCount,
      sharedFileCount: [...matched.values()].filter(count => count > 1).length,
    },
    inventory: { backend: inventory.backend, available: inventory.available, complete: inventory.complete },
    updatedAt: new Date().toISOString(),
  };
}
