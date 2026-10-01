"use client";
import { useEffect, useState } from "react";
import { OFFLINE_DOCUMENTS_CHANGED, offlineDocumentMegabytes, readOfflineDocumentUsage, type OfflineDocumentUsage as Usage } from "@/src/lib/offline-document-usage";

export function OfflineDocumentUsage({ english = false }: { english?: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    let version = 0;
    async function refresh() {
      const request = ++version;
      try {
        if (!("caches" in window)) throw new Error("Cache storage unavailable");
        const next = await readOfflineDocumentUsage(caches);
        if (active && version === request) { setUsage(next); setUnavailable(false); }
      } catch { if (active && version === request) setUnavailable(true); }
    }
    const storageChanged = (event: StorageEvent) => { if (!event.key || event.key.startsWith("bn-trip-offline-")) void refresh(); };
    void refresh();
    window.addEventListener(OFFLINE_DOCUMENTS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_DOCUMENTS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);
  return <small className="offline-document-usage" role="status" aria-live="polite">
    {unavailable ? (english ? "Storage usage unavailable" : "ไม่สามารถอ่านขนาดเอกสารได้") : usage
      ? `${english ? "Saved" : "เก็บไว้"} ${usage.count.toLocaleString("en-US")} ${english ? "files" : "ไฟล์"} · ${offlineDocumentMegabytes(usage.bytes)} MB`
      : (english ? "Calculating storage…" : "กำลังคำนวณขนาดเอกสาร…")}
  </small>;
}
