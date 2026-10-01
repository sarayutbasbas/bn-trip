import { z } from "zod";

export const expensePayerSchema = z.object({ type: z.enum(["member", "guest"]), id: z.string().uuid() }).strict();
