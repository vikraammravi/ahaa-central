import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_CONFIGURED } from "@/lib/supabase/env";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/activate-account",
  "/set-password",
]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_CONFIGURED) return response;

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const isBranch = pathname.startsWith("/branch");
  const isProtected = isAdmin || isBranch;
  const isAuthPage = PUBLIC_ROUTES.has(pathname);

  // Unauthenticated user hitting a protected route → send to /login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login → send to their home based on role
  if (user && pathname === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === "CENTRAL_ADMIN" ? "/admin/dashboard" : "/branch/home";
    return NextResponse.redirect(url);
  }

  // Enforce role separation on protected areas
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "CENTRAL_ADMIN" && isBranch) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
    if (profile?.role === "BRANCH_MANAGER" && isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/branch/home";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\\.).*)",
  ],
};
