import assert from "node:assert/strict";
import test from "node:test";
import { fetchTripDirectoryWindow } from "../src/lib/client-trip-pagination";

test("refresh preserves a loaded window beyond the API page size", async () => {
  const original = globalThis.fetch;
  const offsets: number[] = [];
  globalThis.fetch = async (url) => {
    const params = new URL(String(url), "http://localhost").searchParams;
    const offset = Number(params.get("offset")), limit = Number(params.get("limit"));
    assert.equal(params.get("q"), "เวียดนาม");
    assert.ok(limit <= 50);
    offsets.push(offset);
    return Response.json({ items: Array.from({ length: Math.min(limit, 115 - offset) }, (_, index) => ({ id: offset + index, members: ["new member"] })), hasMore: offset + limit < 115, years: [2025] });
  };
  try {
    const params = new URLSearchParams({ q: "เวียดนาม", mode: "list" });
    const refreshed = await fetchTripDirectoryWindow<{ id: number; members: string[] }>(params, 100);
    assert.equal(refreshed.items.length, 100); assert.equal(refreshed.items[99].id, 99);
    assert.equal(refreshed.items[99].members[0], "new member"); assert.equal(refreshed.hasMore, true);
    assert.deepEqual(offsets, [0, 50]);
    assert.equal((await fetchTripDirectoryWindow(params, 140)).items.length, 115);
    assert.equal((await fetchTripDirectoryWindow(params, 20)).items.length, 20);
  } finally { globalThis.fetch = original; }
});

test("failed later pages reject without returning a truncated list", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new URL(String(url), "http://localhost").searchParams.get("offset") === "0"
    ? Response.json({ items: Array.from({ length: 50 }, (_, id) => ({ id })), hasMore: true })
    : Response.json({ error: "offline" }, { status: 503 });
  try { await assert.rejects(() => fetchTripDirectoryWindow(new URLSearchParams(), 80), /offline/); }
  finally { globalThis.fetch = original; }
});
