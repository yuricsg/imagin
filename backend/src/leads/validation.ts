import { buildWhatsAppUrl } from "../chatbots/catalog.js";
import { isConversationIntentAllowed } from "../chatbots/conversation-flows.js";
import type { ChatbotDefinition } from "../chatbots/types.js";
import type {
  CreateLeadRecordInput,
  LeadIntent,
  LeadRecord,
  LeadSource,
  LeadSubmission,
} from "./types.js";

type ValidationResult =
  | { ok: true; value: LeadSubmission }
  | { ok: false; issues: string[] };

export function validateLeadSubmission(
  botId: string,
  rawBody: unknown,
  chatbot: ChatbotDefinition,
): ValidationResult {
  const issues: string[] = [];

  if (botId !== chatbot.botId) {
    issues.push("botId is not supported");
  }

  if (!isRecord(rawBody)) {
    return { ok: false, issues: ["body must be a JSON object"] };
  }

  const clientId = readRequiredString(rawBody, "clientId", issues);
  const name = readRequiredString(rawBody, "name", issues);
  const intent = readIntent(rawBody.intent, issues);
  const source = readSource(rawBody.source);

  if (!isConversationIntentAllowed(chatbot.flowKey, intent)) {
    issues.push("intent is not enabled for this chatbot flow");
  }

  const submission: LeadSubmission = {
    botId,
    clientId,
    name,
    intent,
    source,
  };

  if (intent === "schedule_exam") {
    const selectedExams = readStringArray(rawBody.selectedExams);
    const medicalRequestStatus = readOptionalString(rawBody.medicalRequestStatus);

    if (selectedExams.length === 0) {
      issues.push("selectedExams must include at least one exam");
    }

    if (!medicalRequestStatus) {
      issues.push("medicalRequestStatus is required");
    }

    if (
      medicalRequestStatus &&
      !chatbot.medicalRequestOptions.includes(medicalRequestStatus)
    ) {
      issues.push("medicalRequestStatus is not supported");
    }

    submission.selectedExams = selectedExams;
    submission.medicalRequestStatus = medicalRequestStatus;
  }

  if (intent === "schedule_consultation") {
    const consultationNeed = readOptionalString(rawBody.consultationNeed);
    const consultationDecision = readOptionalString(rawBody.consultationDecision);

    if (!consultationNeed) {
      issues.push("consultationNeed is required");
    }

    if (!consultationDecision) {
      issues.push("consultationDecision is required");
    }

    if (
      consultationNeed &&
      !chatbot.consultationNeeds.includes(consultationNeed)
    ) {
      issues.push("consultationNeed is not supported");
    }

    if (
      consultationDecision &&
      !chatbot.consultationDecisions.includes(consultationDecision)
    ) {
      issues.push("consultationDecision is not supported");
    }

    submission.consultationNeed = consultationNeed;
    submission.consultationDecision = consultationDecision;
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: submission };
}

export function buildLeadRecordInput(
  submission: LeadSubmission,
  chatbot: ChatbotDefinition,
): CreateLeadRecordInput {
  const whatsappMessage = chatbot.formatWhatsAppMessage(submission);

  return {
    ...submission,
    whatsappMessage,
    whatsappUrl: buildWhatsAppUrl(chatbot, whatsappMessage),
  };
}

export function leadToDto(lead: LeadRecord) {
  return {
    id: lead.id,
    botId: lead.botId,
    clientId: lead.clientId,
    name: lead.name,
    intent: lead.intent,
    selectedExams: lead.selectedExams ?? [],
    medicalRequestStatus: lead.medicalRequestStatus ?? null,
    consultationNeed: lead.consultationNeed ?? null,
    consultationDecision: lead.consultationDecision ?? null,
    source: lead.source,
    whatsappMessage: lead.whatsappMessage,
    whatsappUrl: lead.whatsappUrl,
    status: lead.status,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

function readRequiredString(
  body: Record<string, unknown>,
  field: string,
  issues: string[],
) {
  const value = readOptionalString(body[field]);

  if (!value) {
    issues.push(`${field} is required`);
  }

  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readIntent(value: unknown, issues: string[]): LeadIntent {
  if (
    value === "schedule_exam" ||
    value === "schedule_consultation" ||
    value === "severe_symptoms"
  ) {
    return value;
  }

  issues.push("intent is required");
  return "severe_symptoms";
}

function readSource(value: unknown): LeadSource {
  if (!isRecord(value)) {
    return {};
  }

  return {
    pageUrl: readOptionalString(value.pageUrl) || undefined,
    landingPageUrl: readOptionalString(value.landingPageUrl) || undefined,
    referrer: readOptionalString(value.referrer) || undefined,
    parentOrigin: readOptionalString(value.parentOrigin) || undefined,
    utm: readUtm(value.utm),
    clickIds: readClickIds(value.clickIds),
    cookies: readAttributionCookies(value.cookies),
  };
}

function readUtm(value: unknown): LeadSource["utm"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const utm = {
    source: readOptionalString(value.source) || undefined,
    medium: readOptionalString(value.medium) || undefined,
    campaign: readOptionalString(value.campaign) || undefined,
    content: readOptionalString(value.content) || undefined,
    term: readOptionalString(value.term) || undefined,
    id: readOptionalString(value.id) || undefined,
  };

  return hasAnyValue(utm) ? utm : undefined;
}

function readClickIds(value: unknown): LeadSource["clickIds"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const clickIds = {
    fbclid: readOptionalString(value.fbclid) || undefined,
    gclid: readOptionalString(value.gclid) || undefined,
    gbraid: readOptionalString(value.gbraid) || undefined,
    wbraid: readOptionalString(value.wbraid) || undefined,
    msclkid: readOptionalString(value.msclkid) || undefined,
  };

  return hasAnyValue(clickIds) ? clickIds : undefined;
}

function readAttributionCookies(value: unknown): LeadSource["cookies"] {
  if (!isRecord(value)) {
    return undefined;
  }

  const cookies = {
    fbp: readOptionalString(value.fbp) || undefined,
    fbc: readOptionalString(value.fbc) || undefined,
    gaClientId: readOptionalString(value.gaClientId) || undefined,
  };

  return hasAnyValue(cookies) ? cookies : undefined;
}

function hasAnyValue(value: Record<string, string | undefined>) {
  return Object.values(value).some(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
