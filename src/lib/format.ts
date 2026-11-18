const TZ = "America/New_York";

export function num(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function boolish(value: string | boolean | null | undefined): boolean {
  return value === true || value === "true" || value === "1" || value === "yes" || value === "Yes";
}

export function hubspotDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const ms = Number(value);
  if (!Number.isFinite(ms)) return null;
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hubspotDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  const ms = Number(value);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

/** Noon UTC keeps a HubSpot date-only value on the same calendar day in US time zones. */
export function dateOnlyToIso(yyyyMmDd: string): string {
  return `${yyyyMmDd}T12:00:00.000Z`;
}

type Parts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
};

export function zonedParts(date: Date, timeZone = TZ): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour: bag.hour === "24" ? "00" : bag.hour,
    minute: bag.minute,
    second: bag.second,
    weekday: bag.weekday,
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - date.getTime();
}

export function zonedMidnightUtc(y: number, m: number, d: number, timeZone = TZ): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  const instant = new Date(guess.getTime() - offset);
  const check = timeZoneOffsetMs(instant, timeZone);
  if (check !== offset) return new Date(guess.getTime() - check);
  return instant;
}

function addCalendarDays(y: number, m: number, d: number, days: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export type Window = { start: Date; end: Date };

export function calendarWindow(now: Date, kind: "week" | "month", timeZone = TZ): Window {
  const p = zonedParts(now, timeZone);
  const y = +p.year;
  const m = +p.month;
  const d = +p.day;
  if (kind === "month") {
    const start = zonedMidnightUtc(y, m, 1, timeZone);
    const next = m === 12 ? { y: y + 1, m: 1, d: 1 } : { y, m: m + 1, d: 1 };
    return { start, end: zonedMidnightUtc(next.y, next.m, next.d, timeZone) };
  }
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const mondayDelta = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const monday = addCalendarDays(y, m, d, -mondayDelta);
  const next = addCalendarDays(monday.y, monday.m, monday.d, 7);
  return {
    start: zonedMidnightUtc(monday.y, monday.m, monday.d, timeZone),
    end: zonedMidnightUtc(next.y, next.m, next.d, timeZone),
  };
}

export function inWindow(iso: string | null | undefined, window: Window): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t >= window.start.getTime() && t < window.end.getTime();
}

export function formatEventDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
}

export function formatDayHeading(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

export function dayKey(iso: string, allDay = false): string {
  if (allDay) return iso.slice(0, 10);
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function formatMoney(amount: number | null, currency = "USD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(probability: number | null): string {
  if (probability == null) return "—";
  const pct = probability <= 1 ? probability * 100 : probability;
  return `${Math.round(pct)}%`;
}

export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "No activity";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const delta = now.getTime() - t;
  const min = Math.round(delta / 60000);
  if (Math.abs(min) < 1) return "Just now";
  if (Math.abs(min) < 60) return min > 0 ? `${min}m ago` : `in ${-min}m`;
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return hr > 0 ? `${hr}h ago` : `in ${-hr}h`;
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 14) return day > 0 ? `${day}d ago` : `in ${-day}d`;
  return formatDateTime(iso);
}
