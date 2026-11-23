import { sessionSecret } from "./mode";

export function requestIsSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export const COOKIE_NAME = "spot_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  email: string;
  name: string;
  exp: number;
};

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function createSessionToken(
  user: { email: string; name: string },
  secret = sessionSecret(),
  now = Date.now(),
): Promise<string> {
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  const payload: SessionPayload = {
    email: user.email,
    name: user.name,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = bytesToB64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret = sessionSecret(),
  now = Date.now(),
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || token.split(".").length !== 2) return null;
  let expected: Uint8Array;
  let actual: Uint8Array;
  try {
    expected = await hmac(secret, body);
    actual = b64urlToBytes(sig);
  } catch {
    return null;
  }
  if (!safeEqual(expected, actual)) return null;
  try {
    const json = new TextDecoder().decode(b64urlToBytes(body));
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.email || !payload.name || typeof payload.exp !== "number") return null;
    if (payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
