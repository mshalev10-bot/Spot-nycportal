import {
  HUBSPOT_PORTAL_ID,
  KNOWN_OWNERS,
  PHASE_LABELS,
  RECORD_SOURCE_LABELS,
  SOURCE_LABELS,
  VENUE_LABELS,
  isSpotVenue,
} from "./constants";
import { boolish, dateOnlyToIso, hubspotDateOnly, hubspotDateTime, num } from "./format";
import { previewText } from "./text";
import type { Activity, ActivityVia, Contact, Deal, Stage } from "./types";

export type RawObject = { id: string; properties?: Record<string, string | null> };

function str(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function ownerName(id: string | null, owners: Map<string, string>): string {
  if (!id) return "Unassigned";
  return owners.get(id) ?? KNOWN_OWNERS[id] ?? `Owner ${id}`;
}

export function mapDeal(raw: RawObject, stages: Stage[], owners: Map<string, string>): Deal | null {
  const p = raw.properties ?? {};
  const venue = str(p.venue_options);
  if (!isSpotVenue(venue)) return null;
  const stage = stages.find((item) => item.id === p.dealstage);
  const stageId = str(p.dealstage) ?? "unknown";
  const closedFlag = str(p.hs_is_closed);
  const closed = closedFlag == null ? Boolean(stage?.closed) : boolish(closedFlag);
  const source = str(p.deal_source);
  const recordSource = str(p.hs_object_source_label);
  const analytics = str(p.hs_analytics_source);
  const latest = str(p.hs_analytics_latest_source);
  const analyticsBits = [str(p.hs_analytics_source_data_1), str(p.hs_analytics_source_data_2)].filter(Boolean);
  const phase = str(p.event_phase_of_the_day);
  return {
    id: String(raw.id),
    name: str(p.dealname) ?? "Untitled deal",
    pipelineId: str(p.pipeline) ?? stage?.pipelineId ?? "default",
    pipelineLabel: stage?.pipelineLabel ?? "Events",
    stageId,
    stageLabel: stage?.label ?? stageId,
    stageOrder: stage?.displayOrder ?? 999,
    closed,
    closedWon: boolish(p.hs_is_closed_won) || stageId === "closedwon",
    closedLost: boolish(p.hs_is_closed_lost) || stageId === "closedlost",
    probability: num(p.hs_deal_stage_probability) ?? stage?.probability ?? null,
    venue: venue!,
    venueLabel: VENUE_LABELS[venue!] ?? venue!,
    venueSpace: str(p.venue_space),
    eventDate: hubspotDateOnly(p.event_date),
    eventTime: str(p.event_time),
    eventPhase: phase ? (PHASE_LABELS[phase] ?? phase) : null,
    eventType: str(p.event_type),
    guestCount: num(p.guest_count),
    guests: num(p.guests),
    budget: num(p.budget),
    amount: num(p.amount),
    currency: str(p.deal_currency_code) ?? "USD",
    ownerId: str(p.hubspot_owner_id),
    ownerName: ownerName(str(p.hubspot_owner_id), owners),
    createdAt: hubspotDateTime(p.createdate) ?? new Date(0).toISOString(),
    closeDate: hubspotDateTime(p.closedate),
    lastActivityAt: hubspotDateTime(p.notes_last_updated),
    lastContactedAt: hubspotDateTime(p.notes_last_contacted),
    nextStep: str(p.hs_next_step),
    nextActivityAt: hubspotDateTime(p.notes_next_activity_date),
    nextActivity: str(p.hs_notes_next_activity),
    description: str(p.description)?.slice(0, 4000) ?? null,
    dealSource: source,
    dealSourceLabel: source ? (SOURCE_LABELS[source] ?? source) : "Not set",
    recordSource,
    recordSourceLabel: recordSource ? (RECORD_SOURCE_LABELS[recordSource] ?? recordSource) : null,
    recordSourceDetail: str(p.hs_object_source_detail_1),
    analyticsSource: analytics ? (SOURCE_LABELS[analytics] ?? analytics) : null,
    analyticsDetail: analyticsBits.length ? analyticsBits.join(" · ") : null,
    latestSource: latest ? (SOURCE_LABELS[latest] ?? latest) : null,
    hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${raw.id}`,
  };
}

export function mapContact(raw: RawObject): Contact {
  const p = raw.properties ?? {};
  const first = str(p.firstname);
  const last = str(p.lastname);
  const email = str(p.email);
  const name = [first, last].filter(Boolean).join(" ") || email || "Contact";
  const analytics = str(p.hs_analytics_source);
  return {
    id: String(raw.id),
    name,
    email,
    phone: str(p.phone),
    venue: str(p.new_venue),
    mainSource: str(p.main_source),
    message: str(p.lead_s_message),
    analyticsSource: analytics ? (SOURCE_LABELS[analytics] ?? analytics) : null,
    pbSmsReply: boolish(p.linq_sms_reply_received),
    pbSmsReplyDate: hubspotDateOnly(p.linq_sms_reply_received_date),
    hasRepliedToLinq: str(p.has_replied_to_linq),
    lastSmsReplyDate: hubspotDateOnly(p.date_of_last_sms_reply),
    hubspotUrl: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-1/${raw.id}`,
  };
}

const EMAIL_DIRECTION: Record<string, string> = {
  EMAIL: "Outgoing",
  INCOMING_EMAIL: "Incoming",
  FORWARDED_EMAIL: "Forwarded",
  DRAFT_EMAIL: "Draft",
};

const TASK_STATUS: Record<string, string> = {
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  WAITING: "Waiting",
};

const TASK_PRIORITY: Record<string, string> = {
  NONE: "No priority",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const ENGAGEMENT_PROPERTIES = {
  emails: [
    "hs_email_subject",
    "hs_email_text",
    "hs_email_html",
    "hs_email_direction",
    "hs_email_status",
    "hs_email_from_email",
    "hs_email_to_email",
    "hs_timestamp",
    "hs_createdate",
    "hubspot_owner_id",
  ],
  notes: ["hs_note_body", "hs_body_preview", "hs_timestamp", "hs_createdate", "hubspot_owner_id"],
  tasks: [
    "hs_task_subject",
    "hs_task_body",
    "hs_task_status",
    "hs_task_priority",
    "hs_timestamp",
    "hs_createdate",
    "hubspot_owner_id",
  ],
  calls: [
    "hs_call_title",
    "hs_call_body",
    "hs_body_preview",
    "hs_call_status",
    "hs_call_direction",
    "hs_timestamp",
    "hs_createdate",
    "hubspot_owner_id",
  ],
  meetings: [
    "hs_meeting_title",
    "hs_meeting_body",
    "hs_meeting_start_time",
    "hs_meeting_end_time",
    "hs_timestamp",
    "hs_createdate",
    "hubspot_owner_id",
  ],
  communications: [
    "hs_communication_channel_type",
    "hs_communication_body",
    "hs_timestamp",
    "hs_communication_logged_from",
    "hs_createdate",
    "hubspot_owner_id",
  ],
} as const;

export type EngagementType = keyof typeof ENGAGEMENT_PROPERTIES;

function stamp(p: Record<string, string | null>): string {
  return hubspotDateTime(p.hs_timestamp) ?? hubspotDateTime(p.hs_createdate) ?? new Date(0).toISOString();
}

function channelLabel(value: string | null): string {
  if (!value) return "Message";
  const key = value.toUpperCase();
  if (key.includes("SMS") || key.includes("TEXT")) return "SMS";
  if (key.includes("WHATS")) return "WhatsApp";
  if (key.includes("LINKEDIN")) return "LinkedIn";
  return value;
}

export function mapEngagement(
  type: EngagementType,
  raw: RawObject,
  via: ActivityVia,
  deal: Pick<Deal, "id" | "name">,
  contactName: string | null,
  owners: Map<string, string>,
): Activity | null {
  const p = raw.properties ?? {};
  const base = {
    id: String(raw.id),
    timestamp: stamp(p),
    allDay: false,
    ownerName: str(p.hubspot_owner_id) ? ownerName(str(p.hubspot_owner_id), owners) : null,
    via,
    contactName,
    dealId: deal.id,
    dealName: deal.name,
    priority: null as string | null,
    from: null as string | null,
    to: null as string | null,
    channel: null as string | null,
    bodyNote: null as string | null,
    status: null as string | null,
    direction: null as string | null,
  };
  if (type === "emails") {
    const direction = str(p.hs_email_direction);
    return {
      ...base,
      kind: "email",
      title: str(p.hs_email_subject) ?? "Email",
      preview: previewText(str(p.hs_email_text) ?? str(p.hs_email_html), 700),
      direction: direction ? (EMAIL_DIRECTION[direction] ?? direction) : null,
      status: str(p.hs_email_status),
      from: str(p.hs_email_from_email),
      to: str(p.hs_email_to_email),
    };
  }
  if (type === "notes") {
    const body = str(p.hs_note_body) ?? str(p.hs_body_preview) ?? "";
    return {
      ...base,
      kind: "note",
      title: "Note",
      preview: previewText(body, 700),
    };
  }
  if (type === "tasks") {
    const status = str(p.hs_task_status);
    const priority = str(p.hs_task_priority);
    return {
      ...base,
      kind: "task",
      title: str(p.hs_task_subject) ?? "Task",
      preview: previewText(str(p.hs_task_body), 700),
      status: status ? (TASK_STATUS[status] ?? status) : null,
      priority: priority ? (TASK_PRIORITY[priority] ?? priority) : null,
    };
  }
  if (type === "calls") {
    const direction = str(p.hs_call_direction);
    return {
      ...base,
      kind: "call",
      title: str(p.hs_call_title) ?? "Call",
      preview: previewText(str(p.hs_body_preview) ?? str(p.hs_call_body), 700),
      direction: direction === "INBOUND" ? "Inbound" : direction === "OUTBOUND" ? "Outbound" : direction,
      status: str(p.hs_call_status),
    };
  }
  if (type === "meetings") {
    const start = hubspotDateTime(p.hs_meeting_start_time);
    const end = hubspotDateTime(p.hs_meeting_end_time);
    const when = start ? `Starts ${start}` : "";
    return {
      ...base,
      kind: "meeting",
      timestamp: start ?? base.timestamp,
      title: str(p.hs_meeting_title) ?? "Meeting",
      preview: previewText([str(p.hs_meeting_body), end ? `Ends ${end}` : ""].filter(Boolean).join("\n"), 700),
      status: when || null,
    };
  }
  const channel = channelLabel(str(p.hs_communication_channel_type));
  const body = previewText(str(p.hs_communication_body), 700);
  return {
    ...base,
    kind: "sms",
    title: channel === "SMS" ? "Text message" : channel,
    preview: body || "Logged communication with no body.",
    direction: null,
    channel,
    from: str(p.hs_communication_logged_from),
    bodyNote: body ? null : "HubSpot returned this communication without a message body.",
  };
}

export function projectBlueFlag(contact: Contact, deal: Pick<Deal, "id" | "name" | "createdAt">): Activity | null {
  if (!contact.pbSmsReply && !contact.pbSmsReplyDate && !contact.lastSmsReplyDate) return null;
  const day = contact.pbSmsReplyDate ?? contact.lastSmsReplyDate;
  return {
    id: `pb-${contact.id}`,
    kind: "pb_flag",
    timestamp: day ? dateOnlyToIso(day) : deal.createdAt,
    allDay: Boolean(day),
    title: "Project Blue SMS reply received",
    preview: "A Project Blue (formerly Linq) workflow marked this contact as having replied by text.",
    direction: "Incoming",
    status: contact.hasRepliedToLinq ? `Linq reply: ${contact.hasRepliedToLinq}` : null,
    priority: null,
    from: contact.phone,
    to: null,
    channel: "SMS",
    ownerName: null,
    via: "flag",
    contactName: contact.name,
    dealId: deal.id,
    dealName: deal.name,
    bodyNote:
      "HubSpot stores the flag and the date on the contact. It does not store the message body. Logged SMS bodies show up separately when the Communications object is readable.",
  };
}
