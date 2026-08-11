import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "bn_trip_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-change-me-before-production");

export async function createSession(userId: string, sharedId: string) {
  return new SignJWT({ sharedId }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("30d").sign(secret);
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.sub!, sharedId: String(payload.sharedId) };
  } catch { return null; }
}
