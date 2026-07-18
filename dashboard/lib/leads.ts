import type {
  ChatAccess,
  Lead,
  LeadAttribution,
  LeadChannel,
  LeadEvent,
  LeadProgress,
  LeadSourceDetails,
  LeadStatus,
} from "./chatbots/types";

const LEAD_STATUSES = new Set<LeadStatus>([
  "new",
  "whatsapp_handoff",
  "appointment_requested",
  "not_interested",
  "abandoned",
  "converted",
]);

export type LeadsResult = {
  leads: Lead[];
  accesses: ChatAccess[];
  error: string | null;
};

export async function getLeads(apiBaseUrl: string): Promise<LeadsResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/leads`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!response.ok) {
      return {
        leads: [],
        accesses: [],
        error: `A API de leads respondeu com status ${response.status}.`,
      };
    }
    const data = (await response.json()) as {
      leads?: unknown[];
      accesses?: unknown[];
    };
    return {
      leads: Array.isArray(data.leads)
        ? data.leads.map(mapApiLead).filter((lead): lead is Lead => lead !== null)
        : [],
      accesses: Array.isArray(data.accesses)
        ? data.accesses
            .map(mapApiAccess)
            .filter((access): access is ChatAccess => access !== null)
        : [],
      error: null,
    };
  } catch {
    return {
      leads: [],
      accesses: [],
      error: "Não foi possível carregar os dados reais da API.",
    };
  }
}

function mapApiLead(raw: unknown): Lead | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.botId !== "string") return null;
  const source = readSource(raw.source);
  const attribution = buildAttribution(source);
  const classification = readClassification(raw.classification, raw.intent);
  const createdAt = readString(raw.createdAt) ?? new Date(0).toISOString();
  const updatedAt = readString(raw.updatedAt) ?? createdAt;

  return {
    id: raw.id,
    leadId: readString(raw.leadId),
    sessionId: readString(raw.sessionId),
    botId: raw.botId,
    clientId: readString(raw.clientId) ?? raw.botId,
    name: readString(raw.name) ?? "",
    email: readString(raw.email) ?? "",
    phone: readString(raw.phone) ?? "",
    status: readStatus(raw.status),
    intent: readString(raw.intent),
    selectedExams: readStringArray(raw.selectedExams),
    medicalRequestStatus: readString(raw.medicalRequestStatus),
    consultationNeed: readString(raw.consultationNeed),
    consultationDecision: readString(raw.consultationDecision),
    customFields: readStringRecord(raw.customFields),
    answers: readAnswers(raw.answers),
    whatsappMessage: readString(raw.whatsappMessage),
    whatsappUrl: readString(raw.whatsappUrl),
    message:
      readString(raw.message) ??
      readString(raw.consultationNeed) ??
      classification.primary,
    sourceUrl: source.pageUrl ?? "",
    attribution,
    source,
    classification,
    progress: readProgress(raw.progress, createdAt, updatedAt),
    events: readEvents(raw.events),
    createdAt,
    updatedAt,
  };
}

function mapApiAccess(raw: unknown): ChatAccess | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw.id);
  const botId = readString(raw.botId);
  const clientId = readString(raw.clientId);
  const openedAt = readString(raw.openedAt);
  return id && botId && clientId && openedAt
    ? {
        id,
        botId,
        clientId,
        openedAt,
        attribution: buildAttribution(readSource(raw.source)),
      }
    : null;
}

function buildAttribution(source: LeadSourceDetails): LeadAttribution {
  const utmSource = source.utm?.source ?? null;
  const utmMedium = source.utm?.medium ?? null;
  const utmCampaign = source.utm?.campaign ?? null;
  return {
    channel: resolveChannel(source),
    utmSource,
    utmMedium,
    utmCampaign,
  };
}

function resolveChannel(source: LeadSourceDetails): LeadChannel {
  const sourceName = source.utm?.source?.toLowerCase() ?? "";
  if (sourceName.includes("google") || source.clickIds?.gclid) return "google";
  if (
    sourceName.includes("facebook") ||
    sourceName.includes("instagram") ||
    sourceName.includes("meta") ||
    source.clickIds?.fbclid ||
    source.cookies?.fbc
  ) {
    return "meta";
  }
  if (!source.referrer) return "direct";
  try {
    const host = new URL(source.referrer).hostname;
    if (/google\.|bing\.|duckduckgo\./.test(host)) return "organic";
    if (source.parentOrigin && new URL(source.parentOrigin).hostname === host) {
      return "direct";
    }
    return "referral";
  } catch {
    return "unknown";
  }
}

function readClassification(value: unknown, intent: unknown) {
  if (isRecord(value)) {
    const primary = readString(value.primary);
    const details = Array.isArray(value.details)
      ? value.details.flatMap((entry) => {
          if (!isRecord(entry)) return [];
          const label = readString(entry.label);
          const detailValue = readString(entry.value);
          return label && detailValue ? [{ label, value: detailValue }] : [];
        })
      : [];
    if (primary) return { primary, details };
  }
  return {
    primary:
      intent === "schedule_exam"
        ? "Agendamento de exame"
        : intent === "schedule_consultation"
          ? "Consulta cardiológica"
          : intent === "severe_symptoms"
            ? "Sintomas graves"
            : "Atendimento geral",
    details: [],
  };
}

function readProgress(value: unknown, createdAt: string, updatedAt: string): LeadProgress {
  const record = isRecord(value) ? value : {};
  return {
    currentStep: readString(record.currentStep),
    openedAt: readString(record.openedAt) ?? createdAt,
    lastActivityAt: readString(record.lastActivityAt) ?? updatedAt,
    completedAt: readString(record.completedAt),
    whatsappClickedAt: readString(record.whatsappClickedAt),
    appointmentRequestedAt: readString(record.appointmentRequestedAt),
    convertedAt: readString(record.convertedAt),
  };
}

function readEvents(value: unknown): LeadEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = readString(entry.id);
    const type = readString(entry.type);
    const createdAt = readString(entry.createdAt);
    if (!id || !type || !createdAt) return [];
    return [{
      id,
      type,
      stepId: readString(entry.stepId) ?? undefined,
      label: readString(entry.label) ?? undefined,
      value: readEventValue(entry.value),
      createdAt,
    }];
  });
}

function readSource(value: unknown): LeadSourceDetails {
  if (!isRecord(value)) return {};
  return {
    pageUrl: readString(value.pageUrl) ?? undefined,
    landingPageUrl: readString(value.landingPageUrl) ?? undefined,
    referrer: readString(value.referrer) ?? undefined,
    parentOrigin: readString(value.parentOrigin) ?? undefined,
    utm: readStringRecord(value.utm) ?? undefined,
    clickIds: readStringRecord(value.clickIds) ?? undefined,
    cookies: readStringRecord(value.cookies) ?? undefined,
  };
}

function readStatus(value: unknown): LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.has(value as LeadStatus)
    ? (value as LeadStatus)
    : "new";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function readStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) result[key] = entry.trim();
  }
  return Object.keys(result).length > 0 ? result : null;
}

function readAnswers(value: unknown): Record<string, string | string[]> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
    if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      result[key] = entry;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function readEventValue(value: unknown): LeadEvent["value"] {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
