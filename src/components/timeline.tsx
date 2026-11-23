import Link from "next/link";
import { formatDateTime, formatEventDate } from "@/lib/format";
import type { Activity } from "@/lib/types";

const KIND_LABEL: Record<Activity["kind"], string> = {
  email: "Email",
  note: "Note",
  task: "Task",
  call: "Call",
  meeting: "Meeting",
  sms: "SMS",
  pb_flag: "Project Blue",
};

function when(item: Activity): string {
  if (item.allDay) return formatEventDate(item.timestamp.slice(0, 10));
  return formatDateTime(item.timestamp);
}

export function Timeline({ items, linkDeals = false }: { items: Activity[]; linkDeals?: boolean }) {
  if (!items.length) {
    return <div className="empty">No emails, notes, tasks, calls, meetings, or texts are on this record yet.</div>;
  }
  return (
    <div className="timeline">
      {items.map((item) => (
        <article key={`${item.dealId}:${item.kind}:${item.id}`} className={item.via === "contact" ? "event event-contact" : "event"}>
          <div className="event-top">
            <span className={item.direction === "Incoming" || item.direction === "Inbound" ? "kind incoming" : "kind"}>
              {KIND_LABEL[item.kind]}
              {item.direction ? ` · ${item.direction}` : ""}
            </span>
            <time dateTime={item.timestamp}>{when(item)}</time>
          </div>
          <h3>{item.title}</h3>
          {linkDeals ? (
            <p className="meta">
              <Link href={`/deals/${item.dealId}`}>{item.dealName}</Link>
            </p>
          ) : null}
          {item.preview ? <p>{item.preview}</p> : null}
          <p className="meta">
            {[
              item.status,
              item.priority,
              item.channel,
              item.from && item.to ? `${item.from} → ${item.to}` : item.from || item.to,
              item.ownerName ? `Owner ${item.ownerName}` : null,
              item.via === "deal" ? "On the deal" : null,
              item.via === "contact" ? `Contact timeline only${item.contactName ? ` · ${item.contactName}` : ""} — may include other venues` : null,
              item.via === "flag" ? `Contact flag${item.contactName ? ` · ${item.contactName}` : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {item.bodyNote ? <p className="meta">{item.bodyNote}</p> : null}
        </article>
      ))}
    </div>
  );
}
