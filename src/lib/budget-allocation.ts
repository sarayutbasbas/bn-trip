import { costSplitCount, isPersonalExpense, type SplitExpense } from "./personal-expenses";

// Integer relative weights. Older settings use basis points; new settings use
// the allocated budget in satang so an entered amount survives save/reload.
export type BudgetAllocation = Record<string, number>;
export function distribute(total: number, weights: BudgetAllocation): BudgetAllocation {
  const entries = Object.entries(weights).sort(([a], [b]) => a.localeCompare(b));
  const sum = entries.reduce((n, [, w]) => n + BigInt(Math.max(0, w)), BigInt(0));
  if (!sum) return Object.fromEntries(entries.map(([key]) => [key, 0]));
  const parts = entries.map(([key, w]) => ({ key, raw: BigInt(total) * BigInt(Math.max(0, w)) }));
  const result = Object.fromEntries(parts.map(({ key, raw }) => [key, Number(raw / sum)]));
  const remaining = total - Object.values(result).reduce((a, b) => a + b, 0);
  parts.sort((a, b) => a.raw % sum === b.raw % sum ? a.key.localeCompare(b.key) : a.raw % sum > b.raw % sum ? -1 : 1);
  for (let i = 0; i < remaining; i++) result[parts[i].key]++;
  return result;
}
export function allocationWeights(saved: BudgetAllocation | null | undefined, keys: string[]) {
  const weights = Object.fromEntries(keys.map(key => [key, saved ? Math.max(0, Number(saved[key]) || 0) : 1]));
  if (!Object.values(weights).some(Boolean)) keys.forEach(key => { weights[key] = 1; });
  return weights;
}
export function effectiveAllocation(saved: BudgetAllocation | null | undefined, keys: string[], total = 10000) {
  return distribute(total, allocationWeights(saved, keys));
}
export function changeAllocation(current: BudgetAllocation, key: string, value: number, total = 10000) {
  if (!(key in current)) return current;
  const others = Object.keys(current).filter(id => id !== key);
  if (!others.length) return { [key]: total };
  const next = Math.min(total, Math.max(0, Math.round(value)));
  return { ...distribute(total - next, allocationWeights(current, others)), [key]: next };
}

export function formatBudgetAmount(value: string | number) {
  const clean = String(value).replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!clean) return "";
  const [whole, decimal] = clean.split(".");
  return `${Number(whole || 0).toLocaleString("en-US")}${decimal === undefined ? "" : `.${decimal.slice(0, 2)}`}`;
}
export function budgetAmountSatang(value: string) {
  const [whole = "0", decimal = ""] = value.replace(/,/g, "").split(".");
  return Number(whole || 0) * 100 + Number(decimal.padEnd(2, "0").slice(0, 2));
}
export function expenseShares(cost: SplitExpense, memberIds: string[], guestIds: string[], allocation?: BudgetAllocation | null, memberGuestIds: string[] = []) {
  const participants = [...new Set([
    ...(Array.isArray(cost.splitMemberIds) ? cost.splitMemberIds : memberIds).map(id => `member:${id}`),
    ...(cost.splitGuestIds || []).map(id => `guest:${id}`),
  ])].sort();
  const amount = Math.round(Number(cost.value || 0) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) return new Map<string, number>();
  const divisor = costSplitCount(cost, participants.length);
  const base = Math.floor(amount / divisor), remainder = amount % divisor;
  const shares = new Map(participants.map((key, index) => [key, base + (index < remainder ? 1 : 0)]));
  if (!allocation || isPersonalExpense(cost.category)) return shares;
  const eligible = [...memberIds.map(id => `member:${id}`), ...memberGuestIds.filter(id => guestIds.includes(id)).map(id => `guest:${id}`)];
  let pool = 0;
  for (const key of eligible) { pool += shares.get(key) || 0; shares.set(key, 0); }
  for (const [key, value] of Object.entries(distribute(pool, allocationWeights(allocation, eligible)))) shares.set(key, value);
  return shares;
}
