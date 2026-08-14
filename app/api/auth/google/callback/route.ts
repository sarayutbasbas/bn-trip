import { createRemoteJWKSet,jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession,SESSION_COOKIE } from "@/src/lib/auth";
import { transaction } from "@/src/lib/db";
import { getAppUrl } from "@/src/lib/app-url";

const googleKeys=createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const normalizeEmail=(value:string)=>value.trim().toLowerCase();

export async function GET(request:Request){
  const requestUrl=new URL(request.url);const code=requestUrl.searchParams.get("code");const state=requestUrl.searchParams.get("state");const jar=await cookies();
  const redirect=(error:string)=>NextResponse.redirect(getAppUrl(request,`/?authError=${encodeURIComponent(error)}`));
  if(!code||!state||state!==jar.get("bn_oauth_state")?.value)return redirect("invalid_oauth_state");
  const clientId=process.env.GOOGLE_CLIENT_ID;const clientSecret=process.env.GOOGLE_CLIENT_SECRET;const nonce=jar.get("bn_oauth_nonce")?.value;const verifier=jar.get("bn_oauth_verifier")?.value;
  if(!clientId||!clientSecret||!nonce||!verifier)return redirect("google_not_configured");
  try{
    const redirectUri=process.env.GOOGLE_REDIRECT_URI||getAppUrl(request,"/api/auth/google/callback").toString();
    const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:"authorization_code",code_verifier:verifier}),cache:"no-store"});
    const tokens=await tokenResponse.json() as {id_token?:string};if(!tokenResponse.ok||!tokens.id_token)throw new Error("token_exchange_failed");
    const {payload}=await jwtVerify(tokens.id_token,googleKeys,{audience:clientId,issuer:["https://accounts.google.com","accounts.google.com"]});
    if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=="string"||typeof payload.sub!=="string")throw new Error("invalid_google_identity");
    const email=normalizeEmail(payload.email);
    const user=await transaction(async client=>{
      const existing=await client.query<{id:string}>("SELECT id FROM users WHERE google_sub=$1 OR lower(email)=$2 ORDER BY google_sub=$1 DESC LIMIT 1",[payload.sub,email]);
      const displayName=typeof payload.name==="string"?payload.name:email;const avatarUrl=typeof payload.picture==="string"?payload.picture:null;
      const row=existing.rows[0]
        ?(await client.query<{id:string;email:string;display_name:string;avatar_url:string|null}>("UPDATE users SET email=$1,google_sub=$2,display_name=CASE WHEN google_sub IS NULL THEN $3 ELSE display_name END,avatar_url=$4,updated_at=now() WHERE id=$5 RETURNING id,email,display_name,avatar_url",[email,payload.sub,displayName,avatarUrl,existing.rows[0].id])).rows[0]
        :(await client.query<{id:string;email:string;display_name:string;avatar_url:string|null}>("INSERT INTO users(email,google_sub,display_name,avatar_url) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,avatar_url",[email,payload.sub,displayName,avatarUrl])).rows[0];
      await client.query("UPDATE trip_collaborators SET user_id=$1 WHERE lower(email)=$2",[row.id,email]);return row;
    });
    const token=await createSession({userId:user.id,email:user.email,displayName:user.display_name,avatarUrl:user.avatar_url});const response=NextResponse.redirect(getAppUrl(request));
    response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});for(const name of ["bn_oauth_state","bn_oauth_nonce","bn_oauth_verifier"])response.cookies.delete(name);return response;
  }catch(error){console.error("Google OAuth callback failed",error);return redirect("google_login_failed")}
}
