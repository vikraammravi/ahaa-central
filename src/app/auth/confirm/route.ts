import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const session = await createSupabaseServer();
  // Only recovery links are accepted; destinations are fixed to this app.
  const result = tokenHash && url.searchParams.get("type") === "recovery"
    ? await session.auth.verifyOtp({token_hash:tokenHash,type:"recovery"})
    : code ? await session.auth.exchangeCodeForSession(code) : null;
  const path = result && !result.error ? "/set-password?flow=reset" : "/forgot-password?error=invalid_link";
  const response = NextResponse.redirect(new URL(path,url.origin));
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}
