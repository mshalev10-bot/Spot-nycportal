import { UNQUALIFIED_STAGE_ID, isSpotVenue } from "./constants";
import { calendarWindow, inWindow } from "./format";
import type { Deal, DealFilters, SortKey } from "./types";

export const DEFAULT_FILTERS: DealFilters = {
  query: "",
  stageId: "",
  ownerId: "",
  source: "",
  eventFrom: "",
  eventTo: "",
  hideUnqualified: false,
  showClosed: false,
  sort: "activity",
};

export function applyDealFilters(deals: Deal[], filters: DealFilters): Deal[] {
  const q = filters.query.trim().toLowerCase();
  const rows = deals.filter((deal) => {
    if (!isSpotVenue(deal.venue)) return false;
    if (!filters.showClosed && deal.closed) return false;
    if (filters.hideUnqualified && deal.stageId === UNQUALIFIED_STAGE_ID) return false;
    if (filters.stageId && deal.stageId !== filters.stageId) return false;
    if (filters.ownerId && deal.ownerId !== filters.ownerId) return false;
    if (filters.source === "__blank__") {
      if (deal.dealSource) return false;
    } else if (filters.source && deal.dealSource !== filters.source) {
      return false;
    }
    if (filters.eventFrom && (!deal.eventDate || deal.eventDate < filters.eventFrom)) return false;
    if (filters.eventTo && (!deal.eventDate || deal.eventDate > filters.eventTo)) return false;
    if (q) {
      const hay = [
        deal.name,
        deal.ownerName,
        deal.dealSourceLabel,
        deal.dealSource,
        deal.venueLabel,
        deal.venue,
        deal.stageLabel,
        deal.eventType,
        deal.recordSourceLabel,
        deal.recordSourceDetail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return sortDeals(rows, filters.sort);
}

function timeDesc(a: string | null, b: string | null): number {
  const ta = a ? Date.parse(a) : Number.NEGATIVE_INFINITY;
  const tb = b ? Date.parse(b) : Number.NEGATIVE_INFINITY;
  return tb - ta;
}

export function sortDeals(deals: Deal[], sort: SortKey): Deal[] {
  const copy = [...deals];
  copy.sort((a, b) => {
    switch (sort) {
      case "created":
        return timeDesc(a.createdAt, b.createdAt);
      case "event":
        return (a.eventDate ?? "9999-99-99").localeCompare(b.eventDate ?? "9999-99-99");
      case "amount":
        return (b.amount ?? Number.NEGATIVE_INFINITY) - (a.amount ?? Number.NEGATIVE_INFINITY);
      case "guests":
        return (b.guestCount ?? Number.NEGATIVE_INFINITY) - (a.guestCount ?? Number.NEGATIVE_INFINITY);
      case "name":
        return a.name.localeCompare(b.name);
      case "stage":
        return a.stageOrder - b.stageOrder || a.name.localeCompare(b.name);
      case "activity":
      default:
        return timeDesc(a.lastActivityAt, b.lastActivityAt) || timeDesc(a.createdAt, b.createdAt);
    }
  });
  return copy;
}

export type BookStats = {
  openDeals: number;
  unqualified: number;
  newThisWeek: number;
  newThisMonth: number;
  openAmount: number;
  openGuests: number;
  bySource: { key: string; label: string; count: number }[];
  byStage: Map<string, number>;
};

export function summarize(deals: Deal[], now = new Date()): BookStats {
  const week = calendarWindow(now, "week");
  const month = calendarWindow(now, "month");
  const open = deals.filter((d) => !d.closed);
  const sources = new Map<string, { label: string; count: number }>();
  const byStage = new Map<string, number>();
  for (const deal of deals) {
    const key = deal.dealSource ?? "__blank__";
    const label = deal.dealSource ? deal.dealSourceLabel : "Not set";
    const prev = sources.get(key) ?? { label, count: 0 };
    prev.count += 1;
    sources.set(key, prev);
    byStage.set(deal.stageId, (byStage.get(deal.stageId) ?? 0) + 1);
  }
  const bySource = [...sources.entries()]
    .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    openDeals: open.length,
    unqualified: deals.filter((d) => !d.closed && d.stageId === UNQUALIFIED_STAGE_ID).length,
    newThisWeek: deals.filter((d) => inWindow(d.createdAt, week)).length,
    newThisMonth: deals.filter((d) => inWindow(d.createdAt, month)).length,
    openAmount: open.reduce((sum, d) => sum + (d.amount ?? 0), 0),
    openGuests: open.reduce((sum, d) => sum + (d.guestCount ?? 0), 0),
    bySource,
    byStage,
  };
}
