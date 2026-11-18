import type { Stage } from "./types";

/** HubSpot portal for I&M Hospitality. Used only to build record links. */
export const HUBSPOT_PORTAL_ID = "24457732";

export const EVENTS_PIPELINE_ID = "default";

/**
 * Internal values of deal property `venue_options` (label: New Venue).
 * The Spot and the legacy West Village name are the same venue.
 * Do not add "Malthouse" — that value is Malthouse FiDi.
 */
export const VENUE_FILTER_VALUES = ["The Spot", "Malthouse Greenwich / West Village"] as const;

export const EXCLUDED_VENUE_VALUE = "Malthouse";

export const UNQUALIFIED_STAGE_ID = "1378340530";

export const LOGO_URL = "https://na1.hubspot-logos.com/a4ac0e83-8b05-4668-8043-dbbcf3a7d117";

export const SITE_URL = "https://www.thespot-nyc.com/";

export const VENUE_ADDRESS = "206 Thompson Street, New York, NY 10012";

export const VENUE_LABELS: Record<string, string> = {
  "The Spot": "The Spot (Formally Known as The Malthouse)",
  "Malthouse Greenwich / West Village": "Malthouse Greenwich / West Village",
};

export const SOURCE_LABELS: Record<string, string> = {
  ORGANIC_SEARCH: "Organic Search",
  PAID_SEARCH: "Paid Search",
  EMAIL_MARKETING: "Email Marketing",
  SOCIAL_MEDIA: "Organic Social",
  REFERRALS: "Referrals",
  OTHER_CAMPAIGNS: "Other Campaigns",
  DIRECT_TRAFFIC: "Direct Traffic",
  OFFLINE: "Offline Sources",
  PAID_SOCIAL: "Paid Social",
};

export const RECORD_SOURCE_LABELS: Record<string, string> = {
  AUTOMATION_PLATFORM: "Automation",
  CRM_UI: "CRM",
  INTEGRATION: "Integration",
};

export const PHASE_LABELS: Record<string, string> = {
  Evening: "Evening",
  "Late Night": "Late Night",
  Afternoon: "Other",
};

/** Events pipeline stages confirmed Nov 17, 2026. Labels are trimmed for display. */
export const FALLBACK_STAGES: Stage[] = [
  { id: "1451285284", label: "Re-engaged", displayOrder: 0, probability: 0.2, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "appointmentscheduled", label: "Connection Made", displayOrder: 1, probability: 0.2, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "qualifiedtobuy", label: "Client Q&A", displayOrder: 2, probability: 0.4, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "1192993846", label: "Pause Stage", displayOrder: 3, probability: 0.4, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "presentationscheduled", label: "Client Presented Offer", displayOrder: 4, probability: 0.6, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "decisionmakerboughtin", label: "Ready to Sign", displayOrder: 5, probability: 0.8, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "contractsent", label: "Signed & Deposit Pending", displayOrder: 6, probability: 0.9, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "closedwon", label: "Closed Won", displayOrder: 7, probability: 1, closed: true, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: "closedlost", label: "Closed Lost", displayOrder: 8, probability: 0, closed: true, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
  { id: UNQUALIFIED_STAGE_ID, label: "Unqualified Deals", displayOrder: 9, probability: 0.2, closed: false, pipelineId: EVENTS_PIPELINE_ID, pipelineLabel: "Events" },
];

export const DEAL_PROPERTIES = [
  "dealname",
  "pipeline",
  "dealstage",
  "hs_is_closed",
  "hs_is_closed_won",
  "hs_is_closed_lost",
  "hs_deal_stage_probability",
  "venue_options",
  "venue_space",
  "event_date",
  "event_time",
  "event_phase_of_the_day",
  "event_type",
  "guest_count",
  "guests",
  "budget",
  "amount",
  "deal_currency_code",
  "hubspot_owner_id",
  "createdate",
  "closedate",
  "notes_last_updated",
  "notes_last_contacted",
  "hs_next_step",
  "notes_next_activity_date",
  "hs_notes_next_activity",
  "description",
  "deal_source",
  "hs_object_source_label",
  "hs_object_source_detail_1",
  "hs_analytics_source",
  "hs_analytics_source_data_1",
  "hs_analytics_source_data_2",
  "hs_analytics_latest_source",
] as const;

export const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "new_venue",
  "main_source",
  "lead_s_message",
  "hs_analytics_source",
  "linq_sms_reply_received",
  "linq_sms_reply_received_date",
  "has_replied_to_linq",
  "date_of_last_sms_reply",
] as const;

export const ENGAGEMENT_TYPES = ["emails", "notes", "tasks", "calls", "meetings"] as const;

export const COMMUNICATIONS_SCOPE = "crm.objects.communications.read";

export const KNOWN_OWNERS: Record<string, string> = {
  "87516299": "Kayleen from the spot (formally known as Malthouse)",
  "94519031": "Kayleen Rosario",
  "81905801": "Kayleen Rosario",
  "92669584": "Tova W",
  "76062909": "Michael Shalev",
  "91943127": "Michael Shalev",
  "94518073": "Michael Shalev",
  "76064777": "Ian Magid",
  "80816677": "Ian Magid",
  "92233275": "Ian Magid",
  "94517865": "Ian Magid",
  "93566542": "Hazel from I&M Hospitality",
  "84034268": "Events Inquiry",
  "95487767": "IandM Leads",
};

export function isSpotVenue(value: string | null | undefined): boolean {
  return VENUE_FILTER_VALUES.includes(value as (typeof VENUE_FILTER_VALUES)[number]);
}
