import { Suspense } from "react";
import { Timeline } from "@/components/timeline";
import { dayKey, formatDayHeading, formatDateTime } from "@/lib/format";
import { getActivityFeed } from "@/lib/portal";
import type { Activity } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <ActivityBody />
    </Suspense>
  );
}

async function ActivityBody() {
  const feed = await getActivityFeed();
  const groups = new Map<string, Activity[]>();
  for (const item of feed.items) {
    const key = dayKey(item.timestamp, item.allDay);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Across Spot deals</p>
          <h1>Recent activity</h1>
          <p className="lede">
            Emails, notes, tasks, calls, meetings, and texts associated with Spot deals, newest first. Contact-only items stay on the deal page so activity from other venues does not flood this feed.
          </p>
        </div>
        <p className="meta">Updated {formatDateTime(feed.fetchedAt)}</p>
      </div>
      {feed.communications.state !== "available" ? (
        <div className="callout">
          <strong>SMS bodies</strong>
          <p>{feed.communications.detail}</p>
          {feed.communications.scopeNeeded ? <p>Scope needed: <code>{feed.communications.scopeNeeded}</code></p> : null}
        </div>
      ) : null}
      {feed.warnings.map((warning) => <div className="callout bad" key={warning}><p>{warning}</p></div>)}
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h2 className="day-label">{formatDayHeading(day)}</h2>
          <Timeline items={items} linkDeals />
        </section>
      ))}
      {feed.items.length === 0 ? <div className="empty">No recent engagement records yet.</div> : null}
    </>
  );
}
