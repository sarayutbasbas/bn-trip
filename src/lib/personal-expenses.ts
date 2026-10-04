export type SplitExpense = {
  value?: number | string;
  category?: string;
  splitMemberIds?: string[];
  splitGuestIds?: string[];
  splitCount?: number;
};

// Shared with the trip's per-person expense summary, including legacy costs.
export function costSplitCount(cost: SplitExpense, fallback = 1) {
  if (Array.isArray(cost.splitGuestIds)) {
    return Math.max(1, (cost.splitMemberIds?.length || 0) + cost.splitGuestIds.length);
  }
  const saved = Number(cost.splitCount);
  if (Number.isInteger(saved) && saved >= 1 && saved <= 100) return saved;
  const selectedMembers = cost.splitMemberIds?.length || 0;
  if (selectedMembers) return selectedMembers;
  return Math.min(100, Math.max(1, Math.floor(Number(fallback) || 1)));
}

export function personalExpenseTotals(costs: SplitExpense[], userId: string, memberCount: number) {
  let travelExpense = 0;
  let shoppingExpense = 0;
  for (const cost of costs) {
    // An explicit empty list means guests only, not all trip members.
    if (Array.isArray(cost.splitMemberIds) && !cost.splitMemberIds.includes(userId)) continue;
    const value = Number(cost.value || 0);
    if (!Number.isFinite(value)) continue;
    const share = value / costSplitCount(cost, memberCount);
    if ((cost.category || "").trim().toLowerCase() === "shopping") shoppingExpense += share;
    else travelExpense += share;
  }
  return { travelExpense, shoppingExpense };
}

// Budget usage is the responsibility of account members, not money advanced
// for named guests. Keep the original expense untouched for settlement.
export function memberExpenseValue(cost: SplitExpense, memberIds: string[]) {
  const members = new Set(memberIds);
  const selected = Array.isArray(cost.splitMemberIds)
    ? new Set(cost.splitMemberIds.filter(id => members.has(id))).size
    : members.size;
  const value = Number(cost.value || 0);
  if (!selected || !Number.isFinite(value)) return 0;
  const divisor = costSplitCount(cost, members.size);
  return value * Math.min(1, selected / divisor);
}
