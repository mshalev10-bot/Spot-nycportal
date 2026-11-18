import Link from "next/link";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/timeline";
import { formatDateTime, formatEventDate, formatMoney, formatNumber, formatPercent, relativeTime } from "@/lib/format";
import { getDealDetail } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDealDetail(id);
  if (!detail) notFound();
  const { deal, contacts, activities, communications, warnings, mode } = detail;
  const fields: { label: string; value: string }[] = [
    { label: "Venue", value: deal.venueLabel },
    { label: "Venue space", value: deal.venueSpace ?? "—" },
    { label: "Stage", value: `${deal.stageLabel} · ${deal.pipelineLabel}` },
    { label: "Probability", value: formatPercent(deal.probability) },
    { label: "Event date", value: formatEventDate(deal.eventDate) },
    { label: "Event time", value: deal.eventTime ?? "—" },
    { label: "Phase", value: deal.eventPhase ?? "—" },
    { label: "Event type", value: deal.eventType ?? "—" },
    { label: "Guest count", value: formatNumber(deal.guestCount) },
    { label: "Guests field", value: formatNumber(deal.guests) },
    { label: "Amount", value: formatMoney(deal.amount, deal.currency) },
    { label: "Budget", value: formatMoney(deal.budget, deal.currency) },
    { label: "Owner", value: deal.ownerName },
    { label: "Deal source", value: deal.dealSourceLabel },
    { label: "Record source", value: [deal.recordSourceLabel, deal.recordSourceDetail].filter(Boolean).join(" · ") || "—" },
    { label: "Original traffic", value: [deal.analyticsSource, deal.analyticsDetail].filter(Boolean).join(" · ") || "—" },
    { label: "Latest traffic", value: deal.latestSource ?? "—" },
    { label: "Created", value: formatDateTime(deal.createdAt) },
    { label: "Close date", value: formatDateTime(deal.closeDate) },
    { label: "Last activity", value: `${relativeTime(deal.lastActivityAt)} · ${formatDateTime(deal.lastActivityAt)}` },
    { label: "Last contacted", value: formatDateTime(deal.lastContactedAt) },
    { label: "Next step", value: deal.nextStep ?? "—" },
    { label: "Next activity", value: [deal.nextActivity, formatDateTime(deal.nextActivityAt)].filter((item) => item && item !== "—").join(" · ") || "—" },
    { label: "Status", value: deal.closedWon ? "Closed won" : deal.closedLost ? "Closed lost" : deal.closed ? "Closed" : "Open" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker"><Link href="/">Pipeline</Link> · {deal.stageLabel}</p>
          <h1>{deal.name}</h1>
          <p className="lede">{deal.venueLabel} · {deal.ownerName}</p>
        </div>
        {deal.hubspotUrl ? (
          <a className="back" href={deal.hubspotUrl} target="_blank" rel="noreferrer">Open in HubSpot</a>
        ) : (
          <span className="meta">Demo record</span>
        )}
      </div>

      {communications.state !== "available" ? (
        <div className="callout bad">
          <strong>SMS bodies are not available</strong>
          <p>{communications.detail}</p>
          {communications.scopeNeeded ? <p>Add this private-app scope: <code>{communications.scopeNeeded}</code></p> : null}
        </div>
      ) : (
        <div className="callout">
          <strong>Texts</strong>
          <p>{communications.detail}</p>
        </div>
      )}
      {warnings.map((warning) => <div className="callout bad" key={warning}><p>{warning}</p></div>)}

      <div className="facts">
        <section className="panel">
          <h2>Deal</h2>
          {deal.description ? <p>{deal.description}</p> : null}
          <dl className="fact-grid">
            {fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>Contacts</h2>
          <div className="contact-list">
            {contacts.length === 0 ? <div className="empty">No associated contacts.</div> : null}
            {contacts.map((contact) => (
              <article className="contact-card" key={contact.id}>
                <h3>{contact.name}</h3>
                {contact.email ? <p><a href={`mailto:${contact.email}`}>{contact.email}</a></p> : null}
                {contact.phone ? <p>{contact.phone}</p> : null}
                {contact.venue ? <p>Venue on contact: {contact.venue}</p> : null}
                {contact.mainSource ? <p>Main source: {contact.mainSource}</p> : null}
                {contact.message ? <p>{contact.message}</p> : null}
                {contact.pbSmsReply || contact.pbSmsReplyDate ? (
                  <p>Project Blue SMS reply {contact.pbSmsReply ? "received" : "date set"}{contact.pbSmsReplyDate ? ` · ${contact.pbSmsReplyDate}` : ""}</p>
                ) : (
                  <p>No Project Blue SMS reply flag</p>
                )}
                {contact.hubspotUrl && mode === "live" ? <p><a href={contact.hubspotUrl}>Open contact</a></p> : null}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2>Activity</h2>
        <p className="lede">Engagements on the deal and on its contacts, deduped. Contact-only items are marked because a contact can also have deals at other venues.</p>
        <Timeline items={activities} />
      </section>
    </>
  );
}
