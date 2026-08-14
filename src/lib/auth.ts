import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "bn_trip_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-change-me-before-production");

export type SessionUser = { userId:string; email:string; displayName:string; avatarUrl:string|null; isDemo?:boolean };

export async function createSession(user: SessionUser) {
  return new SignJWT({ email:user.email,displayName:user.displayName,avatarUrl:user.avatarUrl,demo:Boolean(user.isDemo) })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.userId).setIssuedAt().setExpirationTime("30d").sign(secret);
}

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if(!payload.sub||typeof payload.email!=="string")return null;
    return { userId:payload.sub,email:payload.email,displayName:String(payload.displayName||payload.email),avatarUrl:typeof payload.avatarUrl==="string"?payload.avatarUrl:null,isDemo:payload.demo===true };
  } catch { return null; }
}
