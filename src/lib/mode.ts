export function demoModeFromEnv(env: {
  DEMO_MODE?: string;
  HUBSPOT_PRIVATE_APP_TOKEN?: string;
}): boolean {
  const flag = env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return !env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
}

export function isDemoMode(): boolean {
  return demoModeFromEnv({
    DEMO_MODE: process.env.DEMO_MODE,
    HUBSPOT_PRIVATE_APP_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN,
  });
}

export function cacheTtlMs(): number {
  const raw = Number(process.env.CACHE_TTL_SECONDS ?? 180);
  const seconds = Number.isFinite(raw) ? Math.min(300, Math.max(120, raw)) : 180;
  return seconds * 1000;
}

const DEMO_SECRET = "demo-only-not-for-production";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  if (secret.length >= 16) return secret;
  if (isDemoMode()) return DEMO_SECRET;
  return "";
}
