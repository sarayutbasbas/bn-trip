import { z } from "zod";

export const tripNoteSchema = z.string().trim().max(500);
