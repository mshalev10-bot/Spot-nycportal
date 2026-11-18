import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { isDemoMode } from "./mode";

export type OwnerUser = {
  email: string;
  name: string;
  passwordHash: string;
};

/**
 * Built-in accounts. They are used only when demo mode is on and no real
 * owner list is configured. Passwords are demo-spot-2026 and demo-kayleen-2026.
 */
export const DEMO_USERS: OwnerUser[] = [
  {
    email: "owner@thespot-nyc.com",
    name: "Venue owner",
    passwordHash:
      "scrypt$1d8cb8c567aa80587fb8461353b412a7$0b7ac4da2f13c323f4efec7ecf7f1c96becb46156444a9e42c7cb491ead8e03c659303cd2fb8af243f35ebddad06583c359bb85425f7ee5bd1a116759a62614d",
  },
  {
    email: "kayleen@thespot-nyc.com",
    name: "Kayleen Rosario",
    passwordHash:
      "scrypt$d358ba57fb25174dd6910ca86d5b212f$3a49b67543970c4ed0113dca8abf307724702aedd33100b04e63fac644fd770d021ad90f9e195c1d7b828f7177131df40ad4900d5d82028fe69675e551cdb154",
  },
];

export function resolveUsers(configured: OwnerUser[], demoMode: boolean): OwnerUser[] {
  if (configured.length) return configured;
  if (demoMode) return DEMO_USERS;
  return [];
}

function normalize(raw: unknown): OwnerUser[] {
  if (!Array.isArray(raw)) throw new Error("Owner accounts must be a JSON array.");
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Owner account ${index + 1} is not an object.`);
    const row = entry as Record<string, unknown>;
    const email = String(row.email ?? "").trim().toLowerCase();
    const name = String(row.name ?? "").trim();
    const passwordHash = String(row.passwordHash ?? "").trim();
    if (!email.includes("@") || !name || !passwordHash.startsWith("scrypt$")) {
      throw new Error(`Owner account ${index + 1} needs email, name, and a scrypt passwordHash.`);
    }
    return { email, name, passwordHash };
  });
}

export function configuredUsers(): OwnerUser[] {
  const fromEnv = process.env.OWNER_USERS?.trim();
  if (fromEnv) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fromEnv);
    } catch {
      throw new Error("OWNER_USERS is not valid JSON.");
    }
    return normalize(parsed);
  }
  const file = process.env.OWNER_USERS_FILE?.trim() || path.join(process.cwd(), "data", "users.json");
  if (!existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(`Could not read owner accounts from ${file}.`);
  }
  return normalize(parsed);
}

export function activeUsers(): OwnerUser[] {
  return resolveUsers(configuredUsers(), isDemoMode());
}

export function usingBuiltInDemoUsers(): boolean {
  return isDemoMode() && configuredUsers().length === 0;
}
