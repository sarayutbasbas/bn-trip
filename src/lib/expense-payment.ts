import { accommodationPaymentStatus, bangkokDate } from "./accommodation-payment";

export type ExpensePayment = {
  accommodationPaymentDate?: string | null;
  accommodationPaymentStatus?: "paid" | "pending" | null;
};

export function isExpenseUnpaid(cost: ExpensePayment, today = bangkokDate()) {
  return accommodationPaymentStatus(cost.accommodationPaymentDate, cost.accommodationPaymentStatus, today) === "pending";
}
