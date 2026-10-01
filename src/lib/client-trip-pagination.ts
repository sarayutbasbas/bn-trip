import type { TripFilterMember } from "./trip-member-filter";
export async function fetchTripDirectoryWindow<T>(params: URLSearchParams, visibleCount: number, signal?: AbortSignal) {
  const target = Math.max(20, visibleCount);
  const items: T[] = [];
  let latest: { items: T[]; years: number[]; filterMembers?: TripFilterMember[]; hasMore: boolean; statusCounts?: { all: number; ongoing: number; upcoming: number; past: number } } | undefined;
  while (items.length < target) {
    const page = new URLSearchParams(params);
    page.set("limit", String(Math.min(50, target - items.length)));
    page.set("offset", String(items.length));
    const response = await fetch(`/api/trips?${page}`, { signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดทริปไม่สำเร็จ");
    latest = data;
    const received = Array.isArray(data.items) ? data.items as T[] : [];
    items.push(...received);
    if (!data.hasMore || !received.length) break;
  }
  return { ...latest!, items };
}
