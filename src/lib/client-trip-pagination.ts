import type { TripFilterMember } from "./trip-member-filter";
export async function fetchTripDirectoryPage(params: URLSearchParams, signal?: AbortSignal, timeoutMs = 20000) {
  const controller = new AbortController();
  let rejectPending!: (reason: Error) => void;
  const stopped = new Promise<never>((_, reject) => { rejectPending = reject; });
  const cancel = () => {
    rejectPending(new DOMException("Aborted", "AbortError"));
    controller.abort();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    rejectPending(new Error("โหลดทริปนานเกินไป กรุณากดลองอีกครั้ง"));
    controller.abort();
  }, timeoutMs);
  try {
    return await Promise.race([stopped, (async () => {
      const response = await fetch(`/api/trips?${params}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดทริปไม่สำเร็จ");
      return data;
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function fetchTripDirectoryWindow<T>(params: URLSearchParams, visibleCount: number, signal?: AbortSignal) {
  const target = Math.max(20, visibleCount);
  const items: T[] = [];
  let latest: { items: T[]; years: number[]; filterMembers?: TripFilterMember[]; hasMore: boolean; statusCounts?: { all: number; ongoing: number; upcoming: number; past: number; favorite: number } } | undefined;
  while (items.length < target) {
    const page = new URLSearchParams(params);
    page.set("limit", String(Math.min(50, target - items.length)));
    page.set("offset", String(items.length));
    const data = await fetchTripDirectoryPage(page, signal);
    latest = data;
    const received = Array.isArray(data.items) ? data.items as T[] : [];
    items.push(...received);
    if (!data.hasMore || !received.length) break;
  }
  return { ...latest!, items };
}
