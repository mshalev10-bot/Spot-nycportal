import { NextResponse } from "next/server";
import { isDemoMode, sessionSecret } from "@/lib/mode";
import { verifyPassword } from "@/lib/password";
import { COOKIE_NAME, createSessionToken, requestIsSecure, SESSION_MAX_AGE_SECONDS } from "@/lib/session";
import { safeNext } from "@/lib/text";
import { activeUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; reset: number }>();

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

function tooMany(key: string): boolean {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.reset < now) return false;
  return row.count >= 8;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.reset < now) {
    attempts.set(key, { count: 1, reset: now + 10 * 60 * 1000 });
    return;
  }
  row.count += 1;
}

function clearFailures(key: string): void {
  attempts.delete(key);
}

function loginRedirect(request: Request, error: string, next: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!originOk(request)) return new NextResponse("Forbidden", { status: 403 });

  let email = "";
  let password = "";
  let next = "/";
  try {
    const form = await request.formData();
    email = String(form.get("email") ?? "").trim().toLowerCase();
    password = String(form.get("password") ?? "");
    next = safeNext(String(form.get("next") ?? "/"));
  } catch {
    return loginRedirect(request, "credentials", "/");
  }

  if (!isDemoMode() && !sessionSecret()) return loginRedirect(request, "config", next);

  let users;
  try {
    users = activeUsers();
  } catch {
    return loginRedirect(request, "config", next);
  }
  if (!users.length) return loginRedirect(request, "config", next);

  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0]?.trim() || "local";
  const key = `${ip}:${email}`;
  if (tooMany(key)) return loginRedirect(request, "rate", next);

  const user = users.find((item) => item.email === email);
  const valid = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    recordFailure(key);
    return loginRedirect(request, "credentials", next);
  }
  clearFailures(key);

  const token = await createSessionToken(user);
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: requestIsSecure(request),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
