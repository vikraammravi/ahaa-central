import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { activeRole, safeNextPath, userHome } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBranch = pathname === "/branch" || pathname.startsWith("/branch/");
  const protectedRoute = isAdmin || isBranch;
  if (!SUPABASE_CONFIGURED) {
    return protectedRoute ? new NextResponse("Application authentication is not configured.", { status: 503 }) : response;
  }
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const redirect = (path: string, reason?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (reason) url.searchParams.set("reason", reason);
    if (path === "/login" && protectedRoute) url.searchParams.set("next", pathname);
    const result = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (protectedRoute && (!user || authError)) return redirect("/login");
  if (user && (protectedRoute || pathname === "/login")) {
    const { data: profile, error } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
    const role = activeRole(error ? null : profile);
    if (!role) {
      await supabase.auth.signOut({ scope: "local" });
      if (protectedRoute) return redirect("/login", "account_inactive");
      return response;
    }
    if (pathname === "/login") {
      const destination = safeNextPath(request.nextUrl.searchParams.get("next"), role);
      const url = new URL(destination, request.url);
      const result = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }
    if ((isAdmin && role !== "CENTRAL_ADMIN") || (isBranch && role !== "BRANCH_MANAGER")) return redirect(userHome(role));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\\.).*)"] };
