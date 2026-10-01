import assert from "node:assert/strict";
import { prepareTripPlanDownload, saveTripPlanDownload } from "../src/lib/trip-plan-download";

async function main() {
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  globalThis.fetch = async () => new Response("workbook", { headers: { "Content-Type": mime } });
  const file = await prepareTripPlanDownload("trip-id", "Tokyo/Osaka");
  assert.equal(file.name, "Tokyo-Osaka-plan.xlsx");
  assert.equal(await file.text(), "workbook");
  globalThis.fetch = async () => new Response("error", { status: 500 });
  await assert.rejects(prepareTripPlanDownload("id", "test"));
  globalThis.fetch = async () => new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } });
  await assert.rejects(prepareTripPlanDownload("id", "test"));
  let shared: File[] = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => true,
    share: async ({ files }: { files: File[] }) => { shared = files; },
  } });
  await saveTripPlanDownload(file);
  assert.deepEqual(shared, [file]);
  navigator.share = async () => { throw new DOMException("Cancelled", "AbortError"); };
  await assert.rejects(saveTripPlanDownload(file), { name: "AbortError" });
  let clicked = false;
  const link = { href: "", download: "", target: "", rel: "", click: () => { clicked = true; }, remove() {} };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => link, body: { appendChild() {} } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: (callback: () => void) => callback() } });
  await saveTripPlanDownload(file);
  assert(clicked);
  assert.equal(link.target, "_blank");
  assert.equal(link.download, file.name);
  assert(link.href.startsWith("blob:"));
  console.log("PASS: workbook validation, file sharing, cancellation, non-navigating download fallback");
}
void main();
