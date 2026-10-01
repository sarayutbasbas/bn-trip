import { costSplitCount, type SplitExpense } from "./personal-expenses";

export type ExpensePayer = { type: "member" | "guest"; id: string };
export type SettlementExpense = SplitExpense & { paidBy?: ExpensePayer };
export const expensePersonKey = (person: ExpensePayer) => `${person.type}:${person.id}`;

// Integer satang arithmetic: every counted expense must balance exactly.
// Legacy entries without a payer (or with unidentified split slots) stay pending.
export function expenseSettlement(costs: SettlementExpense[], memberIds: string[], guestIds: string[]) {
  const rows = new Map<string, { paid: number; share: number; balance: number }>();
  for (const id of memberIds) rows.set(`member:${id}`, { paid: 0, share: 0, balance: 0 });
  for (const id of guestIds) rows.set(`guest:${id}`, { paid: 0, share: 0, balance: 0 });
  let pendingCount = 0;
  let pendingAmount = 0;
  for (const cost of costs) {
    const amount = Math.round(Number(cost.value || 0) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) continue;
    const participants = [...new Set([
      ...(Array.isArray(cost.splitMemberIds) ? cost.splitMemberIds : memberIds).map(id => `member:${id}`),
      ...(cost.splitGuestIds || []).map(id => `guest:${id}`),
    ])].sort();
    const payer = cost.paidBy ? rows.get(expensePersonKey(cost.paidBy)) : undefined;
    if (!payer || !participants.length || participants.some(id => !rows.has(id)) || costSplitCount(cost, participants.length) !== participants.length) {
      pendingCount++;
      pendingAmount += amount;
      continue;
    }
    payer.paid += amount;
    const share = Math.floor(amount / participants.length);
    const remainder = amount % participants.length;
    participants.forEach((id, index) => { rows.get(id)!.share += share + (index < remainder ? 1 : 0); });
  }
  for (const row of rows.values()) row.balance = row.paid - row.share;
  return { rows, pendingCount, pendingAmount };
}
