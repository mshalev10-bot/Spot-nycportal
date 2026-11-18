import type { Activity } from "./types";

const viaRank: Record<Activity["via"], number> = {
  deal: 3,
  contact: 2,
  flag: 1,
};

/** One card per engagement. A deal association wins over a contact-only copy of the same record. */
export function dedupeActivities(items: Activity[]): Activity[] {
  const map = new Map<string, Activity>();
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    if (viaRank[item.via] > viaRank[prev.via]) {
      map.set(key, { ...item, contactName: item.contactName ?? prev.contactName });
    } else {
      map.set(key, { ...prev, contactName: prev.contactName ?? item.contactName });
    }
  }
  return [...map.values()].sort((a, b) => {
    const delta = Date.parse(b.timestamp) - Date.parse(a.timestamp);
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title);
  });
}
