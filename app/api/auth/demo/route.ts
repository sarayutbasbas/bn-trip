import { NextResponse } from "next/server";
import { createSession,SESSION_COOKIE } from "@/src/lib/auth";
import { getAppUrl } from "@/src/lib/app-url";
import { DEMO_USER_ID,getDemoProfile } from "@/src/lib/demo-data";

export async function GET(request:Request){
  const profile=getDemoProfile();
  const token=await createSession({userId:DEMO_USER_ID,email:profile.email,displayName:profile.display_name,avatarUrl:profile.avatar_url,isDemo:true});
  const response=NextResponse.redirect(getAppUrl(request));
  response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*6});
  return response;
}
