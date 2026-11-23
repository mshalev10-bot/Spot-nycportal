"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UNQUALIFIED_STAGE_ID } from "@/lib/constants";
import { applyDealFilters, DEFAULT_FILTERS, summarize } from "@/lib/filters";
import { formatDateTime, formatEventDate, formatMoney, formatNumber, relativeTime } from "@/lib/format";
import type { DealFilters, PortalSnapshot, SortKey } from "@/lib/types";

const SORTS: SortKey[] = ["activity", "created", "event", "amount", "guests", "name", "stage"];

function readFilters(params: URLSearchParams): DealFilters {
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? "",
    stageId: params.get("stage") ?? "",
    ownerId: params.get("owner") ?? "",
    source: params.get("source") ?? "",
    eventFrom: params.get("from") ?? "",
    eventTo: params.get("to") ?? "",
    hideUnqualified: params.get("unqualified") === "hide",
    showClosed: params.get("closed") === "show",
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "activity",
  };
}

function writeFilters(filters: DealFilters, view: "board" | "table"): string {
  const next = new URLSearchParams();
  if (filters.query) next.set("q", filters.query);
  if (filters.stageId) next.set("stage", filters.stageId);
  if (filters.ownerId) next.set("owner", filters.ownerId);
  if (filters.source) next.set("source", filters.source);
  if (filters.eventFrom) next.set("from", filters.eventFrom);
  if (filters.eventTo) next.set("to", filters.eventTo);
  if (filters.hideUnqualified) next.set("unqualified", "hide");
  if (filters.showClosed) next.set("closed", "show");
  if (filters.sort !== "activity") next.set("sort", filters.sort);
  if (view === "table") next.set("view", "table");
  return next.toString();
}

export function Dashboard({ snapshot, initialParams }: { snapshot: PortalSnapshot; initialParams: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<DealFilters>(() => readFilters(new URLSearchParams(initialParams)));
  const [view, setView] = useState<"board" | "table">(new URLSearchParams(initialParams).get("view") === "table" ? "table" : "board");

  useEffect(() => {
    const query = writeFilters(filters, view);
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) router.replace(query ? `/?${query}` : "/", { scroll: false });
  }, [filters, view, router]);

  const toggled = useMemo(
    () =>
      applyDealFilters(snapshot.deals, {
        ...DEFAULT_FILTERS,
        hideUnqualified: filters.hideUnqualified,
        showClosed: filters.showClosed,
      }),
    [snapshot.deals, filters.hideUnqualified, filters.showClosed],
  );
  const visible = useMemo(() => applyDealFilters(snapshot.deals, filters), [snapshot.deals, filters]);
  const stats = useMemo(() => summarize(toggled), [toggled]);
  const openBook = useMemo(
    () => applyDealFilters(snapshot.deals, { ...DEFAULT_FILTERS, showClosed: false }),
    [snapshot.deals],
  );
  const unqualifiedCount = openBook.filter((deal) => deal.stageId === UNQUALIFIED_STAGE_ID).length;

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const deal of toggled) if (deal.ownerId) map.set(deal.ownerId, deal.ownerName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [toggled]);
  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const deal of toggled) map.set(deal.dealSource ?? "__blank__", deal.dealSourceLabel);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [toggled]);

  const narrowing = Boolean(filters.query || filters.stageId || filters.ownerId || filters.source || filters.eventFrom || filters.eventTo);
  const columns = snapshot.stages
    .filter((stage) => filters.showClosed || !stage.closed)
    .filter((stage) => !filters.hideUnqualified || stage.id !== UNQUALIFIED_STAGE_ID)
    .filter((stage) => !narrowing || stage.id === filters.stageId || visible.some((deal) => deal.stageId === stage.id))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const maxSource = stats.bySource[0]?.count ?? 1;
  function patch(partial: Partial<DealFilters>) {
    setFilters((current) => ({ ...current, ...partial }));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Events pipeline</p>
          <h1>The book</h1>
          <p className="lede">
            Deals tagged The Spot or Malthouse Greenwich / West Village. Malthouse FiDi stays out. Open deals are the default, including Unqualified until you hide them.
          </p>
        </div>
        <p className="meta">Updated {formatDateTime(snapshot.fetchedAt)} · refreshes about every 3 minutes</p>
      </div>

      {snapshot.warnings.length ? (
        <div className="callout bad">
          {snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
      {snapshot.communications.state !== "available" ? (
        <div className="callout">
          <strong>Project Blue texts</strong>
          <p>{snapshot.communications.detail}</p>
          {snapshot.communications.scopeNeeded ? <p>Scope needed: <code>{snapshot.communications.scopeNeeded}</code></p> : null}
        </div>
      ) : null}

      <div className="toggles" style={{ marginBottom: 12 }}>
        <button type="button" className="toggle" aria-pressed={filters.hideUnqualified} onClick={() => patch({ hideUnqualified: !filters.hideUnqualified })}>
          {filters.hideUnqualified ? "Unqualified hidden" : "Hide unqualified"}
        </button>
        <button type="button" className="toggle" aria-pressed={filters.showClosed} onClick={() => patch({ showClosed: !filters.showClosed })}>
          {filters.showClosed ? "Closed deals shown" : "Show closed won / lost"}
        </button>
      </div>

      <section className="stats" aria-label="Summary">
        <article className="stat">
          <p>Open deals in view</p>
          <strong>{stats.openDeals}</strong>
          <span>
            {formatNumber(stats.openGuests)} guests
            {filters.hideUnqualified ? ` · ${unqualifiedCount} unqualified hidden` : ` · ${stats.unqualified} unqualified`}
          </span>
        </article>
        <article className="stat">
          <p>New this week</p>
          <strong>{stats.newThisWeek}</strong>
          <span>Created since Monday, New York</span>
        </article>
        <article className="stat">
          <p>New this month</p>
          <strong>{stats.newThisMonth}</strong>
          <span>Created since the first, New York</span>
        </article>
        <article className="stat">
          <p>Open amount</p>
          <strong>{formatMoney(stats.openAmount)}</strong>
          <span>Sum of amount on open deals. Blank amounts count as zero.</span>
        </article>
      </section>

      <section className="panel" aria-label="Deal source">
        <h2>Where they came from</h2>
        {stats.bySource.length === 0 ? <p>No deals in this view.</p> : null}
        {stats.bySource.map((source) => (
          <div className="source-row" key={source.key}>
            <span>{source.label}</span>
            <div className="bar" aria-hidden="true"><i style={{ width: `${Math.max(6, (source.count / maxSource) * 100)}%` }} /></div>
            <b>{source.count}</b>
          </div>
        ))}
      </section>

      <div className="toolbar">
        <label className="field search">
          <span>Search</span>
          <input value={filters.query} onChange={(event) => patch({ query: event.target.value })} placeholder="Name, owner, source" />
        </label>
        <label className="field">
          <span>Stage</span>
          <select value={filters.stageId} onChange={(event) => patch({ stageId: event.target.value })}>
            <option value="">All stages</option>
            {snapshot.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Owner</span>
          <select value={filters.ownerId} onChange={(event) => patch({ ownerId: event.target.value })}>
            <option value="">All owners</option>
            {owners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Source</span>
          <select value={filters.source} onChange={(event) => patch({ source: event.target.value })}>
            <option value="">All sources</option>
            {sources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Event from</span>
          <input type="date" value={filters.eventFrom} onChange={(event) => patch({ eventFrom: event.target.value })} />
        </label>
        <label className="field">
          <span>Event to</span>
          <input type="date" value={filters.eventTo} onChange={(event) => patch({ eventTo: event.target.value })} />
        </label>
        <label className="field">
          <span>Sort</span>
          <select value={filters.sort} onChange={(event) => patch({ sort: event.target.value as SortKey })}>
            <option value="activity">Last activity</option>
            <option value="created">Create date</option>
            <option value="event">Event date</option>
            <option value="amount">Amount</option>
            <option value="guests">Guest count</option>
            <option value="name">Name</option>
            <option value="stage">Stage</option>
          </select>
        </label>
        <div className="segment" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>Board</button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </div>
        {narrowing ? (
          <button type="button" className="ghost" onClick={() => patch({ query: "", stageId: "", ownerId: "", source: "", eventFrom: "", eventTo: "" })}>
            Clear filters
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? <div className="empty">No deals match. Adjust the search or show closed deals.</div> : null}

      {view === "board" ? (
        <div className="board">
          {columns.map((stage) => {
            const cards = visible.filter((deal) => deal.stageId === stage.id);
            return (
              <section className="column" key={stage.id} aria-label={stage.label}>
                <header>
                  <h2>{stage.label}</h2>
                  <span>{cards.length}</span>
                </header>
                <div className="column-body">
                  {cards.map((deal) => <DealCard key={deal.id} deal={deal} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Event</th>
                <th>Guests</th>
                <th>Amount</th>
                <th>Source</th>
                <th>Created</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((deal) => (
                <tr key={deal.id}>
                  <td data-label="Deal"><Link href={`/deals/${deal.id}`}>{deal.name}</Link></td>
                  <td data-label="Stage">{deal.stageLabel}</td>
                  <td data-label="Owner">{deal.ownerName}</td>
                  <td data-label="Event">{formatEventDate(deal.eventDate)}{deal.eventTime ? ` · ${deal.eventTime}` : ""}</td>
                  <td data-label="Guests">{formatNumber(deal.guestCount)}</td>
                  <td data-label="Amount">{formatMoney(deal.amount, deal.currency)}</td>
                  <td data-label="Source">{deal.dealSourceLabel}</td>
                  <td data-label="Created">{formatDateTime(deal.createdAt)}</td>
                  <td data-label="Last activity">{relativeTime(deal.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function DealCard({ deal }: { deal: PortalSnapshot["deals"][number] }) {
  const tone = deal.closedWon ? "card card-won" : deal.closedLost ? "card card-lost" : deal.stageId === UNQUALIFIED_STAGE_ID ? "card card-muted" : "card";
  return (
    <Link className={tone} href={`/deals/${deal.id}`}>
      <h3>{deal.name}</h3>
      <p>{formatEventDate(deal.eventDate)}{deal.eventTime ? ` · ${deal.eventTime}` : ""}</p>
      <p>{formatNumber(deal.guestCount)} guests · {deal.amount == null ? (deal.budget == null ? "No amount" : `Budget ${formatMoney(deal.budget)}`) : formatMoney(deal.amount, deal.currency)}</p>
      <p>{deal.ownerName}</p>
      <p>{relativeTime(deal.lastActivityAt)}</p>
      <div className="tags">
        <span className="tag">{deal.dealSourceLabel}</span>
        {deal.venue !== "The Spot" ? <span className="tag legacy">West Village name</span> : null}
      </div>
    </Link>
  );
}
