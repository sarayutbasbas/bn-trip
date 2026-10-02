import type { SessionUser } from "./auth";

/** Server-side only: use the same gate for the diamond, page, and every admin API. */
export function isStorageAdmin(session: SessionUser | null) {
  const email = (process.env.STORAGE_ADMIN_EMAIL || "sarayutkongpeng@gmail.com").trim().toLowerCase();
  return Boolean(session && !session.isDemo && session.email.trim().toLowerCase() === email);
}
