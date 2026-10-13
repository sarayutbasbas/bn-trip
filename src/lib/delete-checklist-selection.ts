export async function deleteChecklistSelection(ids: string[], itemUrl: (id: string) => string, request: typeof fetch = fetch) {
  const deleted: string[] = [], failed: string[] = [];
  const selected = [...new Set(ids)];
  // Keep existing endpoint authorization and activity logging; bound concurrency.
  for (let offset = 0; offset < selected.length; offset += 4) {
    await Promise.all(selected.slice(offset, offset + 4).map(async id => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await request(itemUrl(id), { method: "DELETE", signal: controller.signal });
        if (!response.ok) throw new Error("delete_failed");
        deleted.push(id);
      } catch { failed.push(id); }
      finally { clearTimeout(timer); }
    }));
  }
  return { deleted, failed };
}
