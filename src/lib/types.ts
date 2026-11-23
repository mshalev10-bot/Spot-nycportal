export type Stage = {
  id: string;
  label: string;
  displayOrder: number;
  probability: number | null;
  closed: boolean;
  pipelineId: string;
  pipelineLabel: string;
};

export type Deal = {
  id: string;
  name: string;
  pipelineId: string;
  pipelineLabel: string;
  stageId: string;
  stageLabel: string;
  stageOrder: number;
  closed: boolean;
  closedWon: boolean;
  closedLost: boolean;
  probability: number | null;
  venue: string;
  venueLabel: string;
  venueSpace: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventPhase: string | null;
  eventType: string | null;
  guestCount: number | null;
  guests: number | null;
  budget: number | null;
  amount: number | null;
  currency: string;
  ownerId: string | null;
  ownerName: string;
  createdAt: string;
  closeDate: string | null;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  nextStep: string | null;
  nextActivityAt: string | null;
  nextActivity: string | null;
  description: string | null;
  dealSource: string | null;
  dealSourceLabel: string;
  recordSource: string | null;
  recordSourceLabel: string | null;
  recordSourceDetail: string | null;
  analyticsSource: string | null;
  analyticsDetail: string | null;
  latestSource: string | null;
  hubspotUrl: string | null;
};

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  venue: string | null;
  mainSource: string | null;
  message: string | null;
  analyticsSource: string | null;
  pbSmsReply: boolean;
  pbSmsReplyDate: string | null;
  hasRepliedToLinq: string | null;
  lastSmsReplyDate: string | null;
  hubspotUrl: string | null;
};

export type ActivityKind = "email" | "note" | "task" | "call" | "meeting" | "sms" | "pb_flag";

export type ActivityVia = "deal" | "contact" | "flag";

export type Activity = {
  id: string;
  kind: ActivityKind;
  timestamp: string;
  allDay: boolean;
  title: string;
  preview: string;
  direction: string | null;
  status: string | null;
  priority: string | null;
  from: string | null;
  to: string | null;
  channel: string | null;
  ownerName: string | null;
  via: ActivityVia;
  contactName: string | null;
  dealId: string;
  dealName: string;
  bodyNote: string | null;
};

export type CommunicationsAccess = {
  state: "available" | "missing_scope" | "unavailable";
  scopeNeeded: string | null;
  detail: string;
};

export type PortalSnapshot = {
  mode: "demo" | "live";
  fetchedAt: string;
  portalId: string;
  deals: Deal[];
  stages: Stage[];
  communications: CommunicationsAccess;
  warnings: string[];
};

export type DealDetail = {
  mode: "demo" | "live";
  deal: Deal;
  contacts: Contact[];
  activities: Activity[];
  communications: CommunicationsAccess;
  warnings: string[];
};

export type ActivityFeed = {
  mode: "demo" | "live";
  fetchedAt: string;
  items: Activity[];
  warnings: string[];
  communications: CommunicationsAccess;
};

export type DealFilters = {
  query: string;
  stageId: string;
  ownerId: string;
  source: string;
  eventFrom: string;
  eventTo: string;
  hideUnqualified: boolean;
  showClosed: boolean;
  sort: SortKey;
};

export type SortKey = "activity" | "created" | "event" | "amount" | "guests" | "name" | "stage";
