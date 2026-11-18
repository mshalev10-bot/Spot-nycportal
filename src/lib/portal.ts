import { cached } from "./cache";
import { demoDetail, demoFeed, demoSnapshot } from "./demo-data";
import { isSpotVenue } from "./constants";
import { loadLiveDeal, loadLiveFeed, loadLiveSnapshot } from "./live";
import { cacheTtlMs, isDemoMode } from "./mode";
import type { ActivityFeed, DealDetail, PortalSnapshot } from "./types";

export async function getSnapshot(): Promise<PortalSnapshot> {
  if (isDemoMode()) return demoSnapshot();
  return cached("snapshot", cacheTtlMs(), loadLiveSnapshot);
}

export async function getDealDetail(id: string): Promise<DealDetail | null> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  if (isDemoMode()) return demoDetail(id);
  const snapshot = await getSnapshot();
  const deal = snapshot.deals.find((item) => item.id === id && isSpotVenue(item.venue));
  if (!deal) return null;
  return cached(`deal:${id}`, cacheTtlMs(), () => loadLiveDeal(deal));
}

export async function getActivityFeed(): Promise<ActivityFeed> {
  if (isDemoMode()) return demoFeed();
  return cached("feed", cacheTtlMs(), async () => {
    const snapshot = await getSnapshot();
    const feed = await loadLiveFeed(snapshot.deals);
    return { ...feed, warnings: [...snapshot.warnings, ...feed.warnings] };
  });
}
