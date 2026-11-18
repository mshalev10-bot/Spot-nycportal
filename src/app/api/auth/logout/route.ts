import { NextResponse } from "next/server";
import { COOKIE_NAME, requestIsSecure } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originOk(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originOk(request)) return new NextResponse("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: requestIsSecure(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
