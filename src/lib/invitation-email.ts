import { z } from "zod";

// Match the invitation APIs, including trimming and the length limit.
const invitationEmailSchema = z.string().trim().email().max(320);

export function isValidInvitationEmail(email: string): boolean {
  return invitationEmailSchema.safeParse(email).success;
}
