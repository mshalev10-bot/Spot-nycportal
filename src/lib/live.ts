import { cacheTtlMs } from "./mode";
import { cached } from "./cache";
import {
  CONTACT_PROPERTIES,
  DEAL_PROPERTIES,
  ENGAGEMENT_TYPES,
  FALLBACK_STAGES,
  UNQUALIFIED_STAGE_ID,
  VENUE_FILTER_VALUES,
} from "./constants";
import {
  HubSpotError,
  batchAssociationIds,
  batchRead,
  hubspot,
  listAssociationIds,
  probeCommunications,
  type CommunicationsProbe,
} from "./hubspot";
import {
  ENGAGEMENT_PROPERTIES,
  mapContact,
  mapDeal,
  mapEngagement,
  projectBlueFlag,
  type EngagementType,
  type RawObject,
} from "./map-crm";
import { dedupeActivities } from "./timeline";
import type { Activity, ActivityFeed, CommunicationsAccess, Contact, Deal, DealDetail, PortalSnapshot, Stage } from "./types";

type SearchResponse = {
  total?: number;
  results?: RawObject[];
  paging?: { next?: { after?: string } };
};

type OwnerRow = { id: string; email?: string; firstName?: string; lastName?: string };
type PipelineResponse = {
  results?: {
    id: string;
    label: string;
    stages?: {
      id: string;
      label: string;
      displayOrder: number;
      metadata?: { probability?: string; isClosed?: string };
    }[];
  }[];
};

function accessFromProbe(probe: CommunicationsProbe): CommunicationsAccess {
  return { state: probe.state, scopeNeeded: probe.scopeNeeded, detail: probe.detail };
}

async function loadOwners(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const archived of ["false", "true"]) {
    let after: string | undefined;
    try {
      for (let page = 0; page < 20; page += 1) {
        const query = new URLSearchParams({ limit: "100", archived });
        if (after) query.set("after", after);
        const data = await hubspot<{ results?: OwnerRow[]; paging?: { next?: { after?: string } } }>(
          `/crm/v3/owners?${query}`,
        );
        for (const owner of data.results ?? []) {
          const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || `Owner ${owner.id}`;
          if (!map.has(String(owner.id))) map.set(String(owner.id), name);
        }
        after = data.paging?.next?.after;
        if (!after) break;
      }
    } catch (error) {
      if (archived === "true") continue;
      throw error;
    }
  }
  return map;
}

async function loadStages(): Promise<{ stages: Stage[]; warning: string | null }> {
  try {
    const data = await hubspot<PipelineResponse>("/crm/v3/pipelines/deals");
    const stages: Stage[] = [];
    for (const pipeline of data.results ?? []) {
      for (const stage of pipeline.stages ?? []) {
        const probability = stage.metadata?.probability == null ? null : Number(stage.metadata.probability);
        stages.push({
          id: stage.id,
          label: stage.label.trim(),
          displayOrder: stage.displayOrder,
          probability: Number.isFinite(probability) ? probability : null,
          closed:
            stage.id === UNQUALIFIED_STAGE_ID
              ? false
              : stage.metadata?.isClosed === "true" || stage.id === "closedwon" || stage.id === "closedlost",
          pipelineId: pipeline.id,
          pipelineLabel: pipeline.label.trim() || pipeline.label,
        });
      }
    }
    if (!stages.length) return { stages: FALLBACK_STAGES, warning: "HubSpot returned no deal stages. Using the documented Events pipeline." };
    return { stages, warning: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Pipeline request failed.";
    return { stages: FALLBACK_STAGES, warning: `Deal stage labels fell back to the documented Events pipeline. ${reason}` };
  }
}

async function loadRawDeals(): Promise<{ records: RawObject[]; warning: string | null }> {
  const records: RawObject[] = [];
  let after: string | undefined;
  let total = 0;
  for (let page = 0; page < 25; page += 1) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "venue_options",
              operator: "IN",
              values: [...VENUE_FILTER_VALUES],
            },
          ],
        },
      ],
      properties: [...DEAL_PROPERTIES],
      limit: 100,
      sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
    };
    if (after) body.after = after;
    const data = await hubspot<SearchResponse>("/crm/v3/objects/deals/search", { method: "POST", body });
    total = data.total ?? total;
    records.push(...(data.results ?? []));
    after = data.paging?.next?.after;
    if (!after) {
      return { records, warning: null };
    }
  }
  return {
    records,
    warning: `Stopped after ${records.length} of ${total || "many"} matching deals so a single view cannot run unbounded.`,
  };
}

export async function loadLiveSnapshot(): Promise<PortalSnapshot> {
  const [owners, stageResult, probe, dealResult] = await Promise.all([
    cached("owners", cacheTtlMs(), loadOwners),
    cached("stages", cacheTtlMs(), loadStages),
    cached("communications-probe", cacheTtlMs(), probeCommunications),
    loadRawDeals(),
  ]);
  const deals = dealResult.records
    .map((record) => mapDeal(record, stageResult.stages, owners))
    .filter((deal): deal is Deal => Boolean(deal));
  const warnings = [stageResult.warning, dealResult.warning].filter((item): item is string => Boolean(item));
  const pipelineStages = stageResult.stages.filter((stage) => stage.pipelineId === "default");
  return {
    mode: "live",
    fetchedAt: new Date().toISOString(),
    portalId: "24457732",
    deals,
    stages: pipelineStages.length ? pipelineStages : stageResult.stages,
    communications: accessFromProbe(probe),
    warnings,
  };
}

function warnFor(type: string, error: unknown): string {
  if (error instanceof HubSpotError) {
    const scope = error.scopes.length ? ` Missing scope: ${error.scopes.join(", ")}.` : "";
    return `${type} could not be read (${error.status}).${scope}`;
  }
  return `${type} could not be read.`;
}

async function idsFor(
  from: "deals" | "contacts",
  id: string,
  toType: string,
): Promise<string[]> {
  try {
    return await listAssociationIds(from, id, toType);
  } catch (error) {
    if (error instanceof HubSpotError && error.status === 404 && toType === "communications") {
      return listAssociationIds(from, id, "0-18");
    }
    throw error;
  }
}

async function readEngagements(
  deal: Deal,
  contacts: Contact[],
  type: EngagementType,
  objectPath: string,
  owners: Map<string, string>,
): Promise<Activity[]> {
  const dealIds = await idsFor("deals", deal.id, type === "communications" ? "communications" : type);
  const contactIds = new Map<string, string[]>();
  for (const contact of contacts) {
    const assocType = type === "communications" ? "communications" : type;
    contactIds.set(contact.id, await idsFor("contacts", contact.id, assocType));
  }
  const all = new Set<string>(dealIds);
  for (const ids of contactIds.values()) ids.forEach((id) => all.add(id));
  if (!all.size) return [];
  const records = await batchRead(objectPath, [...all], [...ENGAGEMENT_PROPERTIES[type]]);
  const activities: Activity[] = [];
  for (const record of records) {
    const onDeal = dealIds.includes(record.id);
    const contact = contacts.find((item) => (contactIds.get(item.id) ?? []).includes(record.id));
    const activity = mapEngagement(type, record, onDeal ? "deal" : "contact", deal, contact?.name ?? null, owners);
    if (activity) activities.push(activity);
  }
  return activities;
}

export async function loadLiveDeal(deal: Deal): Promise<DealDetail> {
  const [owners, probe] = await Promise.all([
    cached("owners", cacheTtlMs(), loadOwners),
    cached("communications-probe", cacheTtlMs(), probeCommunications),
  ]);
  const warnings: string[] = [];
  let contacts: Contact[] = [];
  try {
    const contactIds = await listAssociationIds("deals", deal.id, "contacts");
    const rawContacts = await batchRead("/crm/v3/objects/contacts", contactIds, [...CONTACT_PROPERTIES]);
    contacts = rawContacts.map(mapContact);
  } catch (error) {
    warnings.push(warnFor("Contacts", error));
  }

  const collected: Activity[] = [];
  for (const type of ENGAGEMENT_TYPES) {
    try {
      const rows = await readEngagements(deal, contacts, type, `/crm/v3/objects/${type}`, owners);
      collected.push(...rows);
    } catch (error) {
      warnings.push(warnFor(type, error));
    }
  }

  if (probe.state === "available" && probe.objectPath) {
    try {
      const rows = await readEngagements(deal, contacts, "communications", probe.objectPath, owners);
      collected.push(...rows);
    } catch (error) {
      warnings.push(warnFor("Communications", error));
    }
  }

  for (const contact of contacts) {
    const flag = projectBlueFlag(contact, deal);
    if (flag) collected.push(flag);
  }

  return {
    mode: "live",
    deal,
    contacts,
    activities: dedupeActivities(collected),
    communications: accessFromProbe(probe),
    warnings,
  };
}

export async function loadLiveFeed(deals: Deal[]): Promise<ActivityFeed> {
  const [owners, probe] = await Promise.all([
    cached("owners", cacheTtlMs(), loadOwners),
    cached("communications-probe", cacheTtlMs(), probeCommunications),
  ]);
  const ranked = [...deals].sort((a, b) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return tb - ta;
  });
  const focus = ranked.slice(0, 40);
  const dealIds = focus.map((deal) => deal.id);
  const byId = new Map(focus.map((deal) => [deal.id, deal]));
  const warnings: string[] = [];
  const collected: Activity[] = [];

  const types: { type: EngagementType; path: string; assoc: string }[] = ENGAGEMENT_TYPES.map((type) => ({
    type,
    path: `/crm/v3/objects/${type}`,
    assoc: type,
  }));
  if (probe.state === "available" && probe.objectPath) {
    types.push({ type: "communications", path: probe.objectPath, assoc: probe.associationType ?? "communications" });
  }

  for (const entry of types) {
    try {
      const associations = await batchAssociationIds("deals", entry.assoc, dealIds);
      const objectIds = [...new Set([...associations.values()].flat())];
      const records = await batchRead(entry.path, objectIds, [...ENGAGEMENT_PROPERTIES[entry.type]]);
      const recordById = new Map(records.map((record) => [record.id, record]));
      for (const [dealId, ids] of associations) {
        const deal = byId.get(dealId);
        if (!deal) continue;
        for (const objectId of ids) {
          const record = recordById.get(objectId);
          if (!record) continue;
          const activity = mapEngagement(entry.type, record, "deal", deal, null, owners);
          if (activity) collected.push(activity);
        }
      }
    } catch (error) {
      if (entry.assoc === "communications" && error instanceof HubSpotError && error.status === 404) {
        try {
          const associations = await batchAssociationIds("deals", "0-18", dealIds);
          const objectIds = [...new Set([...associations.values()].flat())];
          const records = await batchRead(entry.path, objectIds, [...ENGAGEMENT_PROPERTIES.communications]);
          const recordById = new Map(records.map((record) => [record.id, record]));
          for (const [dealId, ids] of associations) {
            const deal = byId.get(dealId);
            if (!deal) continue;
            for (const objectId of ids) {
              const record = recordById.get(objectId);
              if (!record) continue;
              const activity = mapEngagement("communications", record, "deal", deal, null, owners);
              if (activity) collected.push(activity);
            }
          }
          continue;
        } catch (inner) {
          warnings.push(warnFor("Communications", inner));
          continue;
        }
      }
      warnings.push(warnFor(entry.type, error));
    }
  }

  try {
    const contactMap = await batchAssociationIds("deals", "contacts", dealIds);
    const contactIds = [...new Set([...contactMap.values()].flat())];
    const rawContacts = await batchRead("/crm/v3/objects/contacts", contactIds, [...CONTACT_PROPERTIES]);
    const contacts = new Map(rawContacts.map((row) => [row.id, mapContact(row)]));
    for (const [dealId, ids] of contactMap) {
      const deal = byId.get(dealId);
      if (!deal) continue;
      for (const contactId of ids) {
        const contact = contacts.get(contactId);
        if (!contact) continue;
        const flag = projectBlueFlag(contact, deal);
        if (flag) collected.push(flag);
      }
    }
  } catch (error) {
    warnings.push(warnFor("Project Blue flags", error));
  }

  return {
    mode: "live",
    fetchedAt: new Date().toISOString(),
    items: dedupeActivities(collected).slice(0, 80),
    warnings,
    communications: accessFromProbe(probe),
  };
}
