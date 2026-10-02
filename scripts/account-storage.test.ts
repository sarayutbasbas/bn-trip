import assert from "node:assert/strict";
import test from "node:test";
import { accountStorageReport, fileStorageKey } from "../src/lib/account-storage";
import { isStorageAdmin } from "../src/lib/storage-admin";

test("matches uploads and both document storage layouts, ignores external images", () => {
  assert.equal(fileStorageKey("/api/uploads/abc.webp"), "uploads/abc.webp");
  assert.equal(fileStorageKey("doc-abc.pdf"), "uploads/doc-abc.pdf");
  assert.equal(fileStorageKey("documents/trip/doc.pdf"), "documents/trip/doc.pdf");
  assert.equal(fileStorageKey("https://store.private.blob.vercel-storage.com/documents/trip/doc.pdf"), "documents/trip/doc.pdf");
  assert.equal(fileStorageKey("https://example.com/image.jpg"), null);
  assert.equal(fileStorageKey("/travel-postcard-fallback.jpg"), null);
});
test("deduplicates per account and global totals, reports shared/unmatched/missing files", () => {
  const accounts = ["a", "b"].map(id => ({ id, displayName: id, email: null, dataBytes: 30, tripCount: 1, ideaCount: 0 }));
  const refs = [{ ownerId: "a", url: "/api/uploads/abc.webp" }, { ownerId: "a", url: "/api/uploads/abc.webp" }, { ownerId: "b", url: "/api/uploads/abc.webp" }, { ownerId: "a", url: "documents/trip/doc.pdf" }, { ownerId: "b", url: "/api/uploads/missing.webp" }];
  const files = new Map([["uploads/abc.webp", 100], ["documents/trip/doc.pdf", 200], ["uploads/unmatched.webp", 50]]);
  const report = accountStorageReport(accounts, refs, { backend: "blob", files, available: true, complete: true });
  assert.equal(report.accounts[0].fileBytes, 300);
  assert.equal(report.accounts[0].fileCount, 2);
  assert.equal(report.accounts[1].missingFileCount, 1);
  assert.equal(report.totals.fileBytes, 350);
  assert.equal(report.totals.unmatchedBytes, 50);
  assert.equal(report.totals.sharedFileCount, 1);
  assert.equal(report.totals.dataBytes, 60);
  const unavailable = accountStorageReport(accounts, refs, { backend: "blob", files: new Map(), available: false, complete: false });
  assert.equal(unavailable.accounts[0].fileBytes, null);
  assert.equal(unavailable.totals.fileBytes, null);
});
test("admin gate denies ordinary/demo/anonymous sessions", () => {
  const owner = { userId: "test", email: process.env.STORAGE_ADMIN_EMAIL || "sarayutkongpeng@gmail.com", displayName: "Owner", avatarUrl: null };
  assert.equal(isStorageAdmin(owner), true);
  assert.equal(isStorageAdmin({ ...owner, isDemo: true }), false);
  assert.equal(isStorageAdmin({ ...owner, email: "other@example.invalid" }), false);
  assert.equal(isStorageAdmin(null), false);
});
