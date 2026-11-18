import { COMMUNICATIONS_SCOPE } from "./constants";

const BASE = "https://api.hubapi.com";

const READ_RULES: { method: "GET" | "POST"; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/crm\/v3\/pipelines\/deals$/ },
  { method: "GET", pattern: /^\/crm\/v3\/owners(\/\d+)?$/ },
  { method: "POST", pattern: /^\/crm\/v3\/objects\/deals\/search$/ },
  { method: "GET", pattern: /^\/crm\/v3\/objects\/deals\/\d+$/ },
  { method: "POST", pattern: /^\/crm\/v3\/objects\/(contacts|emails|notes|tasks|calls|meetings|communications)\/batch\/read$/ },
  { method: "GET", pattern: /^\/crm\/v3\/objects\/communications$/ },
  { method: "POST", pattern: /^\/crm\/v3\/objects\/communications\/search$/ },
  { method: "GET", pattern: /^\/crm\/objects\/2026-09\/communications$/ },
  { method: "POST", pattern: /^\/crm\/objects\/2026-09\/communications\/(batch\/read|search)$/ },
  { method: "GET", pattern: /^\/crm\/v4\/objects\/(deals|contacts)\/\d+\/associations\/(contacts|emails|notes|tasks|calls|meetings|communications|0-18)$/ },
  { method: "POST", pattern: /^\/crm\/v4\/associations\/(deals|contacts)\/(contacts|emails|notes|tasks|calls|meetings|communications|0-18)\/batch\/read$/ },
];

export function assertReadOnly(method: string, rawPath: string): void {
  const upper = method.toUpperCase();
  if (upper !== "GET" && upper !== "POST") {
    throw new Error(`Blocked HubSpot ${upper}. This portal is read-only.`);
  }
  const path = rawPath.split("?")[0] ?? rawPath;
  const ok = READ_RULES.some((rule) => rule.method === upper && rule.pattern.test(path));
  if (!ok) throw new Error(`Blocked HubSpot path ${upper} ${path}. This portal is read-only.`);
}

export class HubSpotError extends Error {
  status: number;
  body: unknown;
  scopes: string[];

  constructor(status: number, body: unknown) {
    super(redact(messageOf(body, status)));
    this.name = "HubSpotError";
    this.status = status;
    this.body = body;
    this.scopes = scopesFromError(body);
  }
}

function messageOf(body: unknown, status: number): string {
  if (status === 401) return "HubSpot rejected the private app token (401).";
  if (body && typeof body === "object" && "message" in body) return String((body as { message: unknown }).message);
  return `HubSpot request failed (${status}).`;
}

export function redact(value: string): string {
  return value.replace(/pat-[a-z0-9-]+/gi, "[token]").replace(/Bearer\s+\S+/gi, "Bearer [token]");
}

export function scopesFromError(body: unknown): string[] {
  const scopes = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if ((key === "requiredGranularScopes" || key === "requiredScopes" || key === "scopes") && Array.isArray(value)) {
        for (const item of value) if (typeof item === "string") scopes.add(item);
      } else {
        walk(value);
      }
    }
  };
  walk(body);
  const blob = JSON.stringify(body ?? "");
  for (const match of blob.matchAll(/[a-z0-9_-]+(?:\.[a-z0-9_-]+)+/g)) {
    const token = match[0];
    if (token.startsWith("crm.") || token.startsWith("sales-email")) scopes.add(token);
  }
  return [...scopes];
}

let lastCall = 0;
let chain: Promise<void> = Promise.resolve();

async function throttle(): Promise<void> {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = chain;
  chain = gate;
  await previous;
  const wait = lastCall + 180 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  release();
}

export type HubSpotRequest = {
  method?: "GET" | "POST";
  body?: unknown;
};

export async function hubspot<T = unknown>(path: string, init: HubSpotRequest = {}): Promise<T> {
  const method = init.method ?? "GET";
  assertReadOnly(method, path);
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();
  if (!token) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not set.");

  let attempt = 0;
  while (true) {
    await throttle();
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 1);
      const seconds = Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter, 1), 10) : 1;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      attempt += 1;
      continue;
    }
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text.slice(0, 300) };
      }
    }
    if (!response.ok) throw new HubSpotError(response.status, json);
    return json as T;
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type AssocResponse = {
  results?: { toObjectId?: number | string; to?: { toObjectId?: number | string; id?: number | string }[] }[];
  paging?: { next?: { after?: string } };
};

export async function listAssociationIds(fromType: "deals" | "contacts", id: string, toType: string): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "500" });
    if (after) query.set("after", after);
    const data = await hubspot<AssocResponse>(`/crm/v4/objects/${fromType}/${id}/associations/${toType}?${query}`);
    for (const row of data.results ?? []) {
      if (row.toObjectId != null) ids.push(String(row.toObjectId));
      for (const to of row.to ?? []) {
        const toId = to.toObjectId ?? to.id;
        if (toId != null) ids.push(String(toId));
      }
    }
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return [...new Set(ids)];
}

type BatchAssoc = {
  results?: {
    from?: { id?: string };
    to?: { toObjectId?: number | string; id?: number | string }[];
  }[];
};

export async function batchAssociationIds(
  fromType: "deals" | "contacts",
  toType: string,
  ids: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const group of chunk([...new Set(ids)], 100)) {
    if (!group.length) continue;
    const data = await hubspot<BatchAssoc>(`/crm/v4/associations/${fromType}/${toType}/batch/read`, {
      method: "POST",
      body: { inputs: group.map((id) => ({ id })) },
    });
    for (const row of data.results ?? []) {
      const fromId = String(row.from?.id ?? "");
      const tos = (row.to ?? []).map((item) => String(item.toObjectId ?? item.id)).filter(Boolean);
      map.set(fromId, [...new Set([...(map.get(fromId) ?? []), ...tos])]);
    }
  }
  return map;
}

type BatchRead = { results?: { id: string; properties?: Record<string, string | null> }[] };

export async function batchRead(
  objectPath: string,
  ids: string[],
  properties: string[],
): Promise<{ id: string; properties: Record<string, string | null> }[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  const results: { id: string; properties: Record<string, string | null> }[] = [];
  for (const group of chunk(unique, 100)) {
    const data = await hubspot<BatchRead>(`${objectPath}/batch/read`, {
      method: "POST",
      body: { properties, inputs: group.map((id) => ({ id })) },
    });
    for (const row of data.results ?? []) {
      results.push({ id: String(row.id), properties: row.properties ?? {} });
    }
  }
  return results;
}

export type CommunicationsProbe = {
  state: "available" | "missing_scope" | "unavailable";
  scopeNeeded: string | null;
  detail: string;
  objectPath: string | null;
  associationType: string | null;
};

export async function probeCommunications(): Promise<CommunicationsProbe> {
  const attempts: { path: string; associationType: string }[] = [
    { path: "/crm/v3/objects/communications", associationType: "communications" },
    { path: "/crm/objects/2026-09/communications", associationType: "communications" },
    { path: "/crm/v3/objects/communications", associationType: "0-18" },
  ];
  let lastMissing: HubSpotError | null = null;
  let sawNotFound = false;
  for (const attempt of attempts) {
    try {
      await hubspot(`${attempt.path}?limit=1&properties=hs_timestamp`);
      return {
        state: "available",
        scopeNeeded: null,
        detail: "Communications records can be read. SMS bodies are shown when a message is associated with the deal or its contacts.",
        objectPath: attempt.path,
        associationType: attempt.associationType,
      };
    } catch (error) {
      if (error instanceof HubSpotError && (error.status === 403 || error.status === 401)) {
        lastMissing = error;
        break;
      }
      if (error instanceof HubSpotError && error.status === 404) {
        sawNotFound = true;
        continue;
      }
      if (error instanceof HubSpotError) {
        return {
          state: "unavailable",
          scopeNeeded: COMMUNICATIONS_SCOPE,
          detail: `Communications could not be read (${error.status}). Project Blue reply flags are still shown. ${error.message}`,
          objectPath: null,
          associationType: null,
        };
      }
      throw error;
    }
  }
  if (lastMissing) {
    const named = lastMissing.scopes.find((scope) => scope.includes("communication")) ?? COMMUNICATIONS_SCOPE;
    return {
      state: "missing_scope",
      scopeNeeded: named,
      detail: `The private app cannot read Communications (SMS) bodies. HubSpot returned ${lastMissing.status}. Add the ${named} scope, then restart the portal. Project Blue reply flags on the contact are still shown; the message body is not stored on those flags.`,
      objectPath: null,
      associationType: null,
    };
  }
  if (sawNotFound) {
    return {
      state: "unavailable",
      scopeNeeded: COMMUNICATIONS_SCOPE,
      detail:
        "The Communications object (0-18) is not available to this token — the API returned 404. Project Blue reply flags are shown instead. Message bodies for those flags are not stored on the contact.",
      objectPath: null,
      associationType: null,
    };
  }
  return {
    state: "unavailable",
    scopeNeeded: COMMUNICATIONS_SCOPE,
    detail: "Communications could not be read.",
    objectPath: null,
    associationType: null,
  };
}
