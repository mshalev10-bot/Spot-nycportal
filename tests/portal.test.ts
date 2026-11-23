import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXCLUDED_VENUE_VALUE, FALLBACK_STAGES, UNQUALIFIED_STAGE_ID, VENUE_FILTER_VALUES } from "../src/lib/constants";
import { buildDemo } from "../src/lib/demo-data";
import { applyDealFilters, DEFAULT_FILTERS } from "../src/lib/filters";
import { calendarWindow, inWindow } from "../src/lib/format";
import { assertReadOnly } from "../src/lib/hubspot";
import { mapDeal } from "../src/lib/map-crm";
import { demoModeFromEnv } from "../src/lib/mode";
import { verifyPassword } from "../src/lib/password";
import { dedupeActivities } from "../src/lib/timeline";
import { previewText, safeNext } from "../src/lib/text";
import { createSessionToken, verifySessionToken } from "../src/lib/session";
import { DEMO_USERS, resolveUsers } from "../src/lib/users";
import type { Activity, Deal } from "../src/lib/types";

const NOW = new Date("2026-11-18T15:00:00.000Z");

function deal(partial: Partial<Deal> & Pick<Deal, "id" | "venue" | "stageId" | "closed">): Deal {
  return {
    name: partial.id,
    pipelineId: "default",
    pipelineLabel: "Events",
    stageLabel: partial.stageId,
    stageOrder: 0,
    closedWon: false,
    closedLost: false,
    probability: null,
    venueLabel: partial.venue,
    venueSpace: null,
    eventDate: null,
    eventTime: null,
    eventPhase: null,
    eventType: null,
    guestCount: null,
    guests: null,
    budget: null,
    amount: null,
    currency: "USD",
    ownerId: "87516299",
    ownerName: "Kayleen",
    createdAt: NOW.toISOString(),
    closeDate: null,
    lastActivityAt: null,
    lastContactedAt: null,
    nextStep: null,
    nextActivityAt: null,
    nextActivity: null,
    description: null,
    dealSource: null,
    dealSourceLabel: "Not set",
    recordSource: null,
    recordSourceLabel: null,
    recordSourceDetail: null,
    analyticsSource: null,
    analyticsDetail: null,
    latestSource: null,
    hubspotUrl: null,
    ...partial,
  };
}

describe("venue filter", () => {
  it("includes both Spot names and excludes FiDi", () => {
    assert.deepEqual([...VENUE_FILTER_VALUES], ["The Spot", "Malthouse Greenwich / West Village"]);
    assert.equal(EXCLUDED_VENUE_VALUE, "Malthouse");
    assert.equal(VENUE_FILTER_VALUES.includes("Malthouse" as "The Spot"), false);
    assert.equal(UNQUALIFIED_STAGE_ID, "1378340530");
  });

  it("drops a FiDi deal even if one is passed in", () => {
    const rows = [
      deal({ id: "spot", venue: "The Spot", stageId: "appointmentscheduled", closed: false }),
      deal({ id: "fidi", venue: "Malthouse", stageId: "appointmentscheduled", closed: false }),
      deal({ id: "west", venue: "Malthouse Greenwich / West Village", stageId: "closedwon", closed: true }),
    ];
    const visible = applyDealFilters(rows, DEFAULT_FILTERS);
    assert.deepEqual(visible.map((row) => row.id), ["spot"]);
  });
});

describe("dashboard filters", () => {
  const rows = [
    deal({ id: "open", venue: "The Spot", stageId: "appointmentscheduled", closed: false }),
    deal({ id: "unq", venue: "The Spot", stageId: UNQUALIFIED_STAGE_ID, closed: false }),
    deal({ id: "won", venue: "The Spot", stageId: "closedwon", closed: true, closedWon: true }),
  ];

  it("defaults to open deals, including unqualified", () => {
    assert.deepEqual(applyDealFilters(rows, DEFAULT_FILTERS).map((row) => row.id).sort(), ["open", "unq"]);
  });

  it("can hide unqualified and show closed", () => {
    const hidden = applyDealFilters(rows, { ...DEFAULT_FILTERS, hideUnqualified: true });
    assert.deepEqual(hidden.map((row) => row.id), ["open"]);
    const closed = applyDealFilters(rows, { ...DEFAULT_FILTERS, showClosed: true });
    assert.equal(closed.some((row) => row.id === "won"), true);
  });
});

describe("calendar windows in New York", () => {
  it("uses Monday and the first of the month, including the DST boundary", () => {
    const week = calendarWindow(NOW, "week");
    const month = calendarWindow(NOW, "month");
    assert.equal(week.start.toISOString(), "2026-11-16T05:00:00.000Z");
    assert.equal(week.end.toISOString(), "2026-11-23T05:00:00.000Z");
    assert.equal(month.start.toISOString(), "2026-11-01T04:00:00.000Z");
    assert.equal(month.end.toISOString(), "2026-12-01T05:00:00.000Z");
    assert.equal(inWindow("2026-11-18T15:00:00.000Z", week), true);
    assert.equal(inWindow("2026-11-15T15:00:00.000Z", week), false);
  });
});

describe("demo book", () => {
  it("covers both venue names, hides FiDi, and has fresh leads", () => {
    const { deals } = buildDemo(NOW);
    assert.equal(deals.some((deal) => deal.venue === "Malthouse"), false);
    assert.equal(deals.some((deal) => deal.venue === "The Spot"), true);
    assert.equal(deals.some((deal) => deal.venue === "Malthouse Greenwich / West Village"), true);
    const open = applyDealFilters(deals, DEFAULT_FILTERS);
    assert.equal(open.some((deal) => deal.stageId === UNQUALIFIED_STAGE_ID), true);
    assert.equal(open.some((deal) => deal.closed), false);
    const week = calendarWindow(NOW, "week");
    assert.equal(deals.some((deal) => inWindow(deal.createdAt, week)), true);
    const maya = deals.find((deal) => deal.id === "demo-maya");
    assert.ok(maya);
    assert.equal(maya.activities.some((item) => item.kind === "sms"), true);
    assert.equal(maya.activities.some((item) => item.kind === "pb_flag"), true);
    assert.equal(maya.activities.some((item) => item.kind === "email" && item.direction === "Incoming"), true);
  });
});

describe("timeline", () => {
  it("keeps the deal copy when the same email is also on the contact", () => {
    const base: Activity = {
      id: "1",
      kind: "email",
      timestamp: NOW.toISOString(),
      allDay: false,
      title: "Hello",
      preview: "Hi",
      direction: "Outgoing",
      status: null,
      priority: null,
      from: null,
      to: null,
      channel: null,
      ownerName: null,
      via: "contact",
      contactName: "Maya",
      dealId: "demo-maya",
      dealName: "Maya",
      bodyNote: null,
    };
    const merged = dedupeActivities([base, { ...base, via: "deal", contactName: null }]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.via, "deal");
    assert.equal(merged[0]?.contactName, "Maya");
  });
});

describe("HubSpot client", () => {
  it("allows read calls and blocks writes", () => {
    assert.doesNotThrow(() => assertReadOnly("POST", "/crm/v3/objects/deals/search"));
    assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/pipelines/deals"));
    assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v3/owners?limit=100"));
    assert.doesNotThrow(() => assertReadOnly("GET", "/crm/v4/objects/deals/123/associations/communications"));
    assert.throws(() => assertReadOnly("PATCH", "/crm/v3/objects/deals/123"));
    assert.throws(() => assertReadOnly("POST", "/crm/v3/objects/deals"));
    assert.throws(() => assertReadOnly("DELETE", "/crm/v3/objects/deals/123"));
  });

  it("does not map a FiDi deal", () => {
    const mapped = mapDeal(
      { id: "9", properties: { venue_options: "Malthouse", dealname: "FiDi party", dealstage: "appointmentscheduled" } },
      FALLBACK_STAGES,
      new Map(),
    );
    assert.equal(mapped, null);
    const spot = mapDeal(
      {
        id: "8",
        properties: {
          venue_options: "The Spot",
          dealname: "Party",
          dealstage: "1378340530",
          hs_is_closed: "false",
          guest_count: "60",
          deal_source: "OFFLINE",
          createdate: "1763400000000",
        },
      },
      FALLBACK_STAGES,
      new Map(),
    );
    assert.equal(spot?.stageLabel, "Unqualified Deals");
    assert.equal(spot?.closed, false);
    assert.equal(spot?.guestCount, 60);
    assert.equal(spot?.dealSourceLabel, "Offline Sources");
  });
});

describe("auth helpers", () => {
  it("verifies the built-in demo passwords and ignores them when real users exist", () => {
    assert.equal(verifyPassword("demo-spot-2026", DEMO_USERS[0]!.passwordHash), true);
    assert.equal(verifyPassword("nope", DEMO_USERS[0]!.passwordHash), false);
    assert.equal(verifyPassword("demo-kayleen-2026", DEMO_USERS[1]!.passwordHash), true);
    const custom = [{ email: "a@b.com", name: "A", passwordHash: "scrypt$aa$bb" }];
    assert.equal(resolveUsers(custom, true).length, 1);
    assert.equal(resolveUsers([], true).length, 2);
    assert.equal(resolveUsers([], false).length, 0);
  });

  it("turns demo mode on only when asked or when no token is configured", () => {
    assert.equal(demoModeFromEnv({}), true);
    assert.equal(demoModeFromEnv({ HUBSPOT_PRIVATE_APP_TOKEN: "pat-test" }), false);
    assert.equal(demoModeFromEnv({ DEMO_MODE: "true", HUBSPOT_PRIVATE_APP_TOKEN: "pat-test" }), true);
    assert.equal(demoModeFromEnv({ DEMO_MODE: "false" }), false);
  });

  it("round-trips an httpOnly session token", async () => {
    const secret = "test-secret-please-123";
    const token = await createSessionToken({ email: "a@b.com", name: "A" }, secret, 1_000);
    const session = await verifySessionToken(token, secret, 1_000);
    assert.equal(session?.email, "a@b.com");
    const tampered = `${token.slice(0, -2)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(await verifySessionToken(tampered, secret, 1_000), null);
    assert.equal(await verifySessionToken(token, secret, 1_000 + 8 * 24 * 3600 * 1000), null);
  });

  it("rejects open redirects", () => {
    assert.equal(safeNext("/deals/demo-maya"), "/deals/demo-maya");
    assert.equal(safeNext("https://evil.example"), "/");
    assert.equal(safeNext("//evil.example"), "/");
    assert.equal(safeNext("/login"), "/");
  });
});

describe("text", () => {
  it("strips email html down to a preview", () => {
    const text = previewText("<p>Hello&nbsp;<b>Maya</b></p><script>nope()</script>", 50);
    assert.equal(text.includes("script"), false);
    assert.equal(text.includes("Hello"), true);
    assert.equal(text.includes("Maya"), true);
  });
});
