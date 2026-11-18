import { FALLBACK_STAGES, HUBSPOT_PORTAL_ID } from "./constants";
import { calendarWindow } from "./format";
import { dedupeActivities } from "./timeline";
import type { Activity, ActivityFeed, CommunicationsAccess, Contact, Deal, DealDetail, PortalSnapshot, Stage } from "./types";

const communications: CommunicationsAccess = {
  state: "available",
  scopeNeeded: null,
  detail:
    "Demo mode includes sample Communications (SMS) records so the timeline can be previewed. Nothing is read from HubSpot.",
};

type Built = Deal & { contacts: Contact[]; activities: Activity[] };

function stage(id: string): Stage {
  const found = FALLBACK_STAGES.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown stage ${id}`);
  return found;
}

function hoursAgo(hours: number, now: Date): string {
  return new Date(now.getTime() - hours * 3600 * 1000).toISOString();
}

function plusDays(days: number, now: Date): string {
  const copy = new Date(now.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function thisWeekStamp(now: Date): string {
  const week = calendarWindow(now, "week");
  const latest = Math.min(now.getTime(), week.end.getTime() - 60_000);
  return new Date(Math.max(week.start.getTime() + 60_000, latest - 2 * 3600 * 1000)).toISOString();
}

function earlierThisMonth(now: Date): string {
  const week = calendarWindow(now, "week");
  const month = calendarWindow(now, "month");
  const candidate = month.start.getTime() + 36 * 3600 * 1000;
  if (candidate < week.start.getTime() && candidate <= now.getTime()) return new Date(candidate).toISOString();
  return new Date(month.start.getTime() + 60_000).toISOString();
}

let seq = 1;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function blankActivity(partial: Pick<Activity, "kind" | "title" | "preview" | "timestamp"> & Partial<Activity>, deal: Pick<Deal, "id" | "name">): Activity {
  return {
    id: partial.id ?? nextId(partial.kind),
    kind: partial.kind,
    timestamp: partial.timestamp,
    allDay: partial.allDay ?? false,
    title: partial.title,
    preview: partial.preview,
    direction: partial.direction ?? null,
    status: partial.status ?? null,
    priority: partial.priority ?? null,
    from: partial.from ?? null,
    to: partial.to ?? null,
    channel: partial.channel ?? null,
    ownerName: partial.ownerName ?? null,
    via: partial.via ?? "deal",
    contactName: partial.contactName ?? null,
    dealId: deal.id,
    dealName: deal.name,
    bodyNote: partial.bodyNote ?? null,
  };
}

export function buildDemo(now = new Date()): { deals: Built[]; communications: CommunicationsAccess } {
  seq = 1;
  const weekStamp = thisWeekStamp(now);
  const monthStamp = earlierThisMonth(now);
  const older = hoursAgo(24 * 45, now);

  const maya = make({
    id: "demo-maya",
    name: "Maya's Holiday Party for 60 Guests @ The Spot on Dec 12, 9pm–12am",
    stageId: "appointmentscheduled",
    venue: "The Spot",
    eventDate: plusDays(24, now),
    eventTime: "9pm–12am",
    eventPhase: "Evening",
    eventType: "Open Bar",
    guestCount: 60,
    budget: 4500,
    amount: null,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: weekStamp,
    lastActivityAt: hoursAgo(1, now),
    lastContactedAt: hoursAgo(1, now),
    dealSource: "Form Submission",
    recordSource: "AUTOMATION_PLATFORM",
    recordSourceLabel: "Automation",
    recordSourceDetail: "The Spot - New Lead -> Email Sequence | Form Submission + Manual Deal Creation (+ TAG Emails)",
    analyticsSource: "Direct Traffic",
    description: "Holiday party. Open bar, standing reception, South Village room.",
    nextStep: "Send the December package and confirm the 9pm start.",
    contacts: [
      {
        id: "demo-contact-maya",
        name: "Maya Ellison",
        email: "maya.ellison@example.com",
        phone: "+1 212-555-0148",
        venue: "The Spot",
        mainSource: "Website",
        message: "Looking at Dec 12 for about 60 people, mostly standing.",
        analyticsSource: "Direct Traffic",
        pbSmsReply: true,
        pbSmsReplyDate: plusDays(0, now),
        hasRepliedToLinq: null,
        lastSmsReplyDate: null,
        hubspotUrl: null,
      },
    ],
  });
  maya.activities = [
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(26, now),
      title: "Your holiday party at The Spot",
      preview: "Hi Maya — thanks for writing in. The Spot (formerly The Malthouse, West Village) can hold a standing party of 60 on Dec 12. I've attached the open-bar outline. — Kayleen, events@thespot-nyc.com",
      direction: "Outgoing",
      status: "SENT",
      from: "events@thespot-nyc.com",
      to: "maya.ellison@example.com",
      ownerName: maya.ownerName,
    }, maya),
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(6, now),
      title: "Re: Your holiday party at The Spot",
      preview: "This works. Can we keep it to 9pm–midnight and do passed appetizers plus an open bar? Happy to hop on a call tomorrow.",
      direction: "Incoming",
      status: "SENT",
      from: "maya.ellison@example.com",
      to: "events@thespot-nyc.com",
    }, maya),
    blankActivity({
      kind: "sms",
      timestamp: hoursAgo(1, now),
      title: "Text message",
      preview: "Yes, Dec 12 works for us — can we do 60 people if a few are standing at the bar?",
      channel: "SMS",
      direction: "Incoming",
      from: "Project Blue",
    }, maya),
    blankActivity({
      kind: "pb_flag",
      timestamp: `${plusDays(0, now)}T12:00:00.000Z`,
      allDay: true,
      title: "Project Blue SMS reply received",
      preview: "A Project Blue (formerly Linq) workflow marked this contact as having replied by text.",
      direction: "Incoming",
      channel: "SMS",
      from: "+1 212-555-0148",
      via: "flag",
      contactName: "Maya Ellison",
      bodyNote: "HubSpot stores the flag and the date on the contact. It does not store the message body. The text above is a separate Communications record.",
    }, maya),
    blankActivity({
      kind: "task",
      timestamp: hoursAgo(-20, now),
      title: "New Lead - Follow up",
      preview: "Call Maya to confirm the open-bar minimum and send the contract draft.",
      status: "Not started",
      priority: "High",
      ownerName: "Kayleen Rosario",
    }, maya),
  ];

  const jonah = make({
    id: "demo-jonah",
    name: "Jonah's Rehearsal Dinner for 40 Guests @ The Spot",
    stageId: "qualifiedtobuy",
    eventDate: plusDays(18, now),
    eventTime: "6:00 pm — 9:00 pm",
    eventPhase: "Evening",
    eventType: "Open/Cash Bar",
    guestCount: 40,
    amount: 8200,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: hoursAgo(5, now),
    lastActivityAt: hoursAgo(5, now),
    dealSource: "TagVenue",
    recordSource: "INTEGRATION",
    recordSourceLabel: "Integration",
    recordSourceDetail: "Zapier",
    contacts: [
      {
        id: "demo-contact-jonah",
        name: "Jonah Adler",
        email: "jonah.adler@example.com",
        phone: "+1 917-555-0114",
        venue: "The Spot",
        mainSource: "Venue Referral",
        message: null,
        analyticsSource: null,
        pbSmsReply: false,
        pbSmsReplyDate: null,
        hasRepliedToLinq: "No",
        lastSmsReplyDate: null,
        hubspotUrl: null,
      },
    ],
  });
  jonah.activities = [
    blankActivity({
      kind: "call",
      timestamp: hoursAgo(5, now),
      title: "Call with Jonah",
      preview: "Outbound, 8 minutes. Walked through the semi-private back room and a split open/cash bar. He will send a headcount by Friday.",
      direction: "Outbound",
      status: "COMPLETED",
      ownerName: jonah.ownerName,
    }, jonah),
  ];

  const priya = make({
    id: "demo-priya",
    name: "Priya's Birthday for 25 Guests @ The Spot",
    stageId: "presentationscheduled",
    eventDate: plusDays(30, now),
    eventTime: "5:00 pm — 8:00 pm",
    eventPhase: "Evening",
    guestCount: 25,
    guests: 28,
    amount: 2575,
    ownerId: "94519031",
    ownerName: "Kayleen Rosario",
    createdAt: monthStamp,
    lastActivityAt: hoursAgo(30, now),
    dealSource: "Eventective",
    contacts: [contact("demo-contact-priya", "Priya Shah", "priya.shah@example.com")],
  });
  priya.activities = [
    blankActivity({
      kind: "meeting",
      timestamp: hoursAgo(30, now),
      title: "Menu tasting",
      preview: "Tasting for the passed-appetizer package. Client liked the mushroom toast and asked about a late-night slider add-on.",
      ownerName: priya.ownerName,
    }, priya),
    blankActivity({
      kind: "note",
      timestamp: hoursAgo(28, now),
      title: "Note",
      preview: "Proposal sent at $2,575. Guest count on the form was 25; she mentioned 28 in the tasting.",
      ownerName: priya.ownerName,
    }, priya),
  ];

  const andre = make({
    id: "demo-andre",
    name: "Andre's Company Mixer for 80 Guests @ The Spot",
    stageId: "contractsent",
    eventDate: plusDays(40, now),
    eventTime: "7:00 pm — 10:00 pm",
    eventPhase: "Evening",
    eventType: "Open Bar",
    guestCount: 80,
    amount: 14000,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: older,
    lastActivityAt: hoursAgo(50, now),
    dealSource: "Party Place",
    venueSpace: "Full venue",
    contacts: [contact("demo-contact-andre", "Andre Williams", "andre.williams@example.com")],
  });
  andre.activities = [
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(50, now),
      title: "Signed contract — deposit pending",
      preview: "Andre — the agreement is countersigned. The deposit link is in this thread. Once it clears, the date is held.",
      direction: "Outgoing",
      status: "SENT",
      from: "events@thespot-nyc.com",
      to: "andre.williams@example.com",
      ownerName: andre.ownerName,
    }, andre),
  ];

  const lena = make({
    id: "demo-lena",
    name: "Lena's Team Offsite for 30 Guests @ The Spot",
    stageId: "1192993846",
    eventDate: plusDays(55, now),
    eventTime: "Afternoon",
    eventPhase: "Other",
    guestCount: 30,
    budget: 3000,
    ownerId: "84034268",
    ownerName: "Events Inquiry",
    createdAt: older,
    lastActivityAt: hoursAgo(80, now),
    dealSource: null,
    nextStep: "Waiting on a revised date from the client.",
    contacts: [contact("demo-contact-lena", "Lena Ortiz", "lena.ortiz@example.com")],
  });
  lena.activities = [
    blankActivity({
      kind: "note",
      timestamp: hoursAgo(80, now),
      title: "Note",
      preview: "Paused. Their office asked to move off the original Thursday. No new date yet.",
      ownerName: "Events Inquiry",
    }, lena),
  ];

  const chris = make({
    id: "demo-chris",
    name: "Chris's Product Launch for 50 Guests @ The Spot",
    stageId: "decisionmakerboughtin",
    eventDate: plusDays(21, now),
    eventTime: "6:30 pm — 9:30 pm",
    guestCount: 50,
    amount: 9600,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: older,
    lastActivityAt: hoursAgo(12, now),
    dealSource: "Restaurent",
    contacts: [contact("demo-contact-chris", "Chris Dalton", "chris.dalton@example.com")],
  });
  chris.activities = [
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(12, now),
      title: "Ready to sign — launch menu",
      preview: "Sending the final menu and the BEO. Once you initial page 2 we can invoice the deposit.",
      direction: "Outgoing",
      status: "SENT",
      from: "events@thespot-nyc.com",
      to: "chris.dalton@example.com",
    }, chris),
  ];

  const samira = make({
    id: "demo-samira",
    name: "Samira's Reunion for 20 Guests @ The Spot",
    stageId: "1451285284",
    eventDate: plusDays(70, now),
    guestCount: 20,
    amount: 1800,
    ownerId: "95487767",
    ownerName: "IandM Leads",
    createdAt: older,
    lastActivityAt: hoursAgo(15, now),
    dealSource: "OFFLINE",
    contacts: [contact("demo-contact-samira", "Samira Qureshi", "samira.qureshi@example.com")],
  });
  samira.activities = [
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(15, now),
      title: "Still thinking about the reunion?",
      preview: "We held a similar night last spring when the room was still The Malthouse. Happy to reopen the date if you want another look.",
      direction: "Outgoing",
      status: "SENT",
      from: "events@thespot-nyc.com",
      to: "samira.qureshi@example.com",
    }, samira),
  ];

  const noah = make({
    id: "demo-noah",
    name: "Noah's Alumni Drinks for 35 Guests @ The Spot",
    stageId: "appointmentscheduled",
    eventDate: plusDays(12, now),
    eventTime: "8:00 pm — 11:00 pm",
    guestCount: 35,
    budget: 2000,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: hoursAgo(20, now),
    lastActivityAt: hoursAgo(20, now),
    dealSource: "Spothopper",
    contacts: [contact("demo-contact-noah", "Noah Berg", "noah.berg@example.com")],
  });
  noah.activities = [
    blankActivity({
      kind: "task",
      timestamp: hoursAgo(-4, now),
      title: "Send availability",
      preview: "Confirm the back room is free and reply on Spothopper.",
      status: "Not started",
      priority: "Medium",
      ownerName: "Kayleen Rosario",
    }, noah),
  ];

  const ruth = make({
    id: "demo-ruth",
    name: "Ruth's Book Launch for 45 Guests @ The Spot",
    stageId: "qualifiedtobuy",
    eventDate: plusDays(33, now),
    guestCount: 45,
    budget: 0,
    ownerId: "76062909",
    ownerName: "Michael Shalev",
    createdAt: monthStamp,
    lastActivityAt: hoursAgo(40, now),
    dealSource: "Instagram Lead Form",
    contacts: [contact("demo-contact-ruth", "Ruth Klein", "ruth.klein@example.com")],
  });
  ruth.activities = [
    blankActivity({
      kind: "note",
      timestamp: hoursAgo(40, now),
      title: "Note",
      preview: "Instagram lead. Budget field came through as 0 — she said she is still pricing it. Asked for a cash-bar option.",
      via: "contact",
      contactName: "Ruth Klein",
      ownerName: "Michael Shalev",
    }, ruth),
  ];

  const unqualified = [
    make({
      id: "demo-unq-1",
      name: "Elliot's Inquiry for 15 Guests @ The Spot",
      stageId: "1378340530",
      guestCount: 15,
      ownerId: "84034268",
      ownerName: "Events Inquiry",
      createdAt: hoursAgo(10, now),
      lastActivityAt: hoursAgo(9, now),
      dealSource: "Facebook Lead Form",
      contacts: [contact("demo-contact-elliot", "Elliot Marsh", "elliot.marsh@example.com")],
    }),
    make({
      id: "demo-unq-2",
      name: "Date request — 200 guests @ The Spot",
      stageId: "1378340530",
      guestCount: 200,
      ownerId: "87516299",
      ownerName: "Kayleen from the spot (formally known as Malthouse)",
      createdAt: older,
      lastActivityAt: hoursAgo(200, now),
      dealSource: "Form Submission",
      contacts: [contact("demo-contact-large", "Casey Nguyen", "casey.nguyen@example.com")],
    }),
    make({
      id: "demo-unq-3",
      name: "Walk-in question @ The Spot",
      stageId: "1378340530",
      guestCount: 10,
      ownerId: "95487767",
      ownerName: "IandM Leads",
      createdAt: monthStamp,
      dealSource: null,
      contacts: [],
    }),
  ];
  unqualified[0]!.activities = [
    blankActivity({
      kind: "note",
      timestamp: hoursAgo(9, now),
      title: "Note",
      preview: "Date already booked. Marked unqualified. Client may come back for a weeknight.",
      ownerName: "Events Inquiry",
    }, unqualified[0]!),
  ];

  const harper = make({
    id: "demo-harper",
    name: "Harper's Post-Game Party for 50 Guests @ Malthouse - West Village",
    stageId: "closedwon",
    venue: "Malthouse Greenwich / West Village",
    eventDate: plusDays(3, now),
    eventTime: "6:00 pm",
    guestCount: 50,
    amount: 6000,
    ownerId: "94519031",
    ownerName: "Kayleen Rosario",
    createdAt: older,
    lastActivityAt: hoursAgo(100, now),
    closeDate: hoursAgo(100, now),
    dealSource: "TagVenue",
    closed: true,
    closedWon: true,
    contacts: [contact("demo-contact-harper", "Harper Diaz", "harper.diaz@example.com")],
  });
  harper.activities = [
    blankActivity({
      kind: "note",
      timestamp: hoursAgo(100, now),
      title: "Note",
      preview: "Deposit received. Deal was booked under the West Village name, before the Spot rebrand. Same room, 206 Thompson.",
      ownerName: "Kayleen Rosario",
    }, harper),
  ];

  const won = make({
    id: "demo-won-summer",
    name: "Summer Supper for 35 Guests @ The Spot",
    stageId: "closedwon",
    eventDate: plusDays(-20, now),
    guestCount: 35,
    amount: 4200,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: hoursAgo(24 * 70, now),
    lastActivityAt: hoursAgo(24 * 20, now),
    closeDate: hoursAgo(24 * 25, now),
    dealSource: "Peerspace",
    closed: true,
    closedWon: true,
    contacts: [contact("demo-contact-summer", "Imani Brooks", "imani.brooks@example.com")],
  });

  const lost = make({
    id: "demo-lost",
    name: "Greyson's Birthday for 40 Guests @ The Spot",
    stageId: "closedlost",
    eventDate: plusDays(-5, now),
    guestCount: 40,
    budget: 2500,
    ownerId: "87516299",
    ownerName: "Kayleen from the spot (formally known as Malthouse)",
    createdAt: older,
    lastActivityAt: hoursAgo(24 * 12, now),
    closeDate: hoursAgo(24 * 12, now),
    dealSource: "PartySlate",
    closed: true,
    closedLost: true,
    contacts: [contact("demo-contact-greyson", "Greyson Hale", "greyson.hale@example.com")],
  });
  lost.activities = [
    blankActivity({
      kind: "email",
      timestamp: hoursAgo(24 * 12, now),
      title: "Re: birthday date",
      preview: "Thanks for the look. We're going to keep it at a friend's apartment instead.",
      direction: "Incoming",
      from: "greyson.hale@example.com",
      to: "events@thespot-nyc.com",
    }, lost),
  ];

  const deals = [maya, jonah, priya, andre, lena, chris, samira, noah, ruth, ...unqualified, harper, won, lost];
  for (const deal of deals) {
    if (!deal.lastActivityAt && deal.activities[0]) deal.lastActivityAt = deal.activities[0].timestamp;
  }
  return { deals, communications };
}

function contact(id: string, name: string, email: string): Contact {
  return {
    id,
    name,
    email,
    phone: null,
    venue: "The Spot",
    mainSource: null,
    message: null,
    analyticsSource: null,
    pbSmsReply: false,
    pbSmsReplyDate: null,
    hasRepliedToLinq: null,
    lastSmsReplyDate: null,
    hubspotUrl: null,
  };
}

function make(input: {
  id: string;
  name: string;
  stageId: string;
  venue?: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventPhase?: string | null;
  eventType?: string | null;
  guestCount?: number | null;
  guests?: number | null;
  budget?: number | null;
  amount?: number | null;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  lastActivityAt?: string | null;
  lastContactedAt?: string | null;
  closeDate?: string | null;
  dealSource: string | null;
  recordSource?: string | null;
  recordSourceLabel?: string | null;
  recordSourceDetail?: string | null;
  analyticsSource?: string | null;
  description?: string | null;
  nextStep?: string | null;
  venueSpace?: string | null;
  closed?: boolean;
  closedWon?: boolean;
  closedLost?: boolean;
  contacts: Contact[];
}): Built {
  const s = stage(input.stageId);
  const venue = input.venue ?? "The Spot";
  const sourceLabels: Record<string, string> = { OFFLINE: "Offline Sources" };
  return {
    id: input.id,
    name: input.name,
    pipelineId: "default",
    pipelineLabel: "Events",
    stageId: s.id,
    stageLabel: s.label,
    stageOrder: s.displayOrder,
    closed: input.closed ?? s.closed,
    closedWon: input.closedWon ?? s.id === "closedwon",
    closedLost: input.closedLost ?? s.id === "closedlost",
    probability: s.probability,
    venue,
    venueLabel: venue === "The Spot" ? "The Spot (Formally Known as The Malthouse)" : "Malthouse Greenwich / West Village",
    venueSpace: input.venueSpace ?? null,
    eventDate: input.eventDate ?? null,
    eventTime: input.eventTime ?? null,
    eventPhase: input.eventPhase ?? null,
    eventType: input.eventType ?? null,
    guestCount: input.guestCount ?? null,
    guests: input.guests ?? null,
    budget: input.budget ?? null,
    amount: input.amount ?? null,
    currency: "USD",
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    createdAt: input.createdAt,
    closeDate: input.closeDate ?? null,
    lastActivityAt: input.lastActivityAt ?? null,
    lastContactedAt: input.lastContactedAt ?? null,
    nextStep: input.nextStep ?? null,
    nextActivityAt: null,
    nextActivity: null,
    description: input.description ?? null,
    dealSource: input.dealSource,
    dealSourceLabel: input.dealSource ? (sourceLabels[input.dealSource] ?? input.dealSource) : "Not set",
    recordSource: input.recordSource ?? "CRM_UI",
    recordSourceLabel: input.recordSourceLabel ?? "CRM",
    recordSourceDetail: input.recordSourceDetail ?? null,
    analyticsSource: input.analyticsSource ?? null,
    analyticsDetail: null,
    latestSource: input.analyticsSource ?? null,
    hubspotUrl: null,
    contacts: input.contacts,
    activities: [],
  };
}

export function demoSnapshot(now = new Date()): PortalSnapshot {
  const { deals, communications: access } = buildDemo(now);
  return {
    mode: "demo",
    fetchedAt: now.toISOString(),
    portalId: HUBSPOT_PORTAL_ID,
    deals: deals.map(({ contacts: _contacts, activities: _activities, ...deal }) => deal),
    stages: FALLBACK_STAGES,
    communications: access,
    warnings: [],
  };
}

export function demoDetail(id: string, now = new Date()): DealDetail | null {
  const { deals, communications: access } = buildDemo(now);
  const found = deals.find((deal) => deal.id === id);
  if (!found) return null;
  const { contacts, activities, ...deal } = found;
  return {
    mode: "demo",
    deal,
    contacts,
    activities: dedupeActivities(activities),
    communications: access,
    warnings: [],
  };
}

export function demoFeed(now = new Date()): ActivityFeed {
  const { deals, communications: access } = buildDemo(now);
  const items = dedupeActivities(deals.flatMap((deal) => deal.activities)).slice(0, 80);
  return { mode: "demo", fetchedAt: now.toISOString(), items, warnings: [], communications: access };
}
