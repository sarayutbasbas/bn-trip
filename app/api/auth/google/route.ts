import { createHash,randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/src/lib/app-url";

const flowCookie=(name:string,value:string,response:NextResponse)=>response.cookies.set(name,value,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:600});

export async function GET(request:Request){
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId)return NextResponse.redirect(getAppUrl(request,"/?authError=google_not_configured"));
  const state=randomBytes(24).toString("base64url");const nonce=randomBytes(24).toString("base64url");const verifier=randomBytes(48).toString("base64url");
  const redirectUri=process.env.GOOGLE_REDIRECT_URI||getAppUrl(request,"/api/auth/google/callback").toString();
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",state,nonce,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",prompt:"select_account"}).toString();
  const response=NextResponse.redirect(url);flowCookie("bn_oauth_state",state,response);flowCookie("bn_oauth_nonce",nonce,response);flowCookie("bn_oauth_verifier",verifier,response);return response;
}
