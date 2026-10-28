import { z } from "zod";
import type { PoolClient } from "pg";

export const shoppingBudgetSchema = z.number().finite().nonnegative().max(999999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.01, "กรุณาระบุทศนิยมไม่เกิน 2 ตำแหน่ง");
export async function savePersonalShoppingBudget(client: PoolClient, tripId: string, userId: string, value: number) {
  await client.query(`INSERT INTO trip_personal_budgets(trip_id,user_id,shopping_budget_thb) VALUES($1,$2,$3)
    ON CONFLICT(trip_id,user_id) DO UPDATE SET shopping_budget_thb=EXCLUDED.shopping_budget_thb,updated_at=now()`,[tripId,userId,value]);
}
