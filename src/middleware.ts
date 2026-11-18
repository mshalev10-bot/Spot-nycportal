import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { safeNext } from "@/lib/text";

function withSecurity(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (pathname === "/login") {
    if (session) {
      const next = safeNext(request.nextUrl.searchParams.get("next"));
      return withSecurity(NextResponse.redirect(new URL(next, request.url)));
    }
    return withSecurity(NextResponse.next());
  }

  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return withSecurity(NextResponse.next());
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return withSecurity(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return withSecurity(NextResponse.redirect(url));
  }

  return withSecurity(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
