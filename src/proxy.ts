import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CONFIGURED } from "@/lib/supabase/env";
import { activeRole, safeNextPath, userHome } from "@/lib/auth";
import { BUSINESS_COOKIE, BUSINESS_HEADER, businessWorkspacesEnabled, selectedBusiness } from "@/features/workspaces/context";
import { loadSessionProfile } from "@/features/workspaces/session";
import { platformConsoleEnabled, platformDeployment } from "@/lib/app-surface";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const platformOnly = platformDeployment();
  const consoleEnabled = platformConsoleEnabled();
  const isPlatformApi = pathname === "/api/platform" || pathname.startsWith("/api/platform/");
  if (platformOnly) {
    if (pathname === "/") return NextResponse.redirect(new URL("/superadmin", request.url));
    if (pathname === "/login" && request.nextUrl.searchParams.get("next") !== "/superadmin") return NextResponse.redirect(new URL("/login?next=/superadmin", request.url));
    const allowed = pathname === "/superadmin" || pathname.startsWith("/superadmin/") || isPlatformApi
      || ["/login", "/forgot-password", "/set-password", "/auth/confirm"].includes(pathname);
    if (!allowed) return new NextResponse("Not found.", { status: 404 });
  } else if (isPlatformApi || pathname === "/superadmin" || pathname.startsWith("/superadmin/") || (pathname === "/login" && request.nextUrl.searchParams.get("next") === "/superadmin")) {
    return new NextResponse("Not found.", { status: 404 });
  }
  // API handlers enforce their own session/role checks. Surface separation applies first.
  if (pathname.startsWith("/api/")) return response;
  const businessMode = businessWorkspacesEnabled();
  const isPlatform = pathname === "/superadmin" || pathname.startsWith("/superadmin/");
  const platformLogin = pathname === "/login" && request.nextUrl.searchParams.get("next") === "/superadmin";
  if (isPlatform && !consoleEnabled) return new NextResponse("Not found.", { status: 404 });
  const isWorkspaces = businessMode && pathname === "/workspaces";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBranch = pathname === "/branch" || pathname.startsWith("/branch/");
  const isEmployee = pathname === "/employee" || pathname.startsWith("/employee/");
  const protectedRoute = isAdmin || isBranch || isEmployee || isWorkspaces || isPlatform;
  if (!SUPABASE_CONFIGURED) {
    return protectedRoute ? new NextResponse("Application authentication is not configured.", { status: 503 }) : response;
  }
  let selection: string | null = null;
  try {
    if (businessMode && !isWorkspaces && !isPlatform && !platformLogin) selection = selectedBusiness(request.cookies.getAll().filter(cookie => cookie.name === BUSINESS_COOKIE).map(cookie => `${cookie.name}=${cookie.value}`).join(";"));
  } catch { return NextResponse.redirect(new URL("/workspaces", request.url)); }
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: selection ? { [BUSINESS_HEADER]: selection } : {} },
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
  if (isPlatform) {
    const permission = await supabase.rpc("platform_is_administrator");
    return !permission.error && permission.data === true ? response : new NextResponse("Platform access is required.", { status: 403 });
  }
  if (pathname === "/login" && user && !authError && platformLogin && consoleEnabled) {
    const permission = await supabase.rpc("platform_is_administrator");
    if (!permission.error && permission.data === true) return redirect("/superadmin");
    return response;
  }
  if (isWorkspaces && user && !authError) return response;
  if (user && (protectedRoute || pathname === "/login")) {
    const { profile, error } = await loadSessionProfile(supabase, user.id);
    const role = activeRole(error ? null : profile);
    if (!role) {
      if (businessMode) return redirect("/workspaces");
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
    if ((isAdmin && role !== "CENTRAL_ADMIN") || (isBranch && role !== "BRANCH_MANAGER") || (isEmployee && role !== "BRANCH_EMPLOYEE")) return redirect(userHome(role));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|aaha-logo\\.(?:png|svg)$|(?:window|vercel|next|globe|file)\\.svg$).*)"] };
