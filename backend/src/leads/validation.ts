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
  const sessionId = readOptionalString(rawBody.sessionId);
  const intent = readIntent(rawBody.intent, issues);
  const source = readLeadSource(rawBody.source);
  const flowMode =
    rawBody.flowMode === "custom_dialogue" ? "custom_dialogue" : "legacy";
  const isCustomDialogue = flowMode === "custom_dialogue";

  if (isCustomDialogue && name.toLocaleLowerCase("pt-BR") === "visitante") {
    issues.push("name must identify a real visitor");
  }

  if (
    !isCustomDialogue &&
    !isConversationIntentAllowed(chatbot.flowKey, intent)
  ) {
    issues.push("intent is not enabled for this chatbot flow");
  }

  const submission: LeadSubmission = {
    botId,
    clientId,
    name,
    intent,
    source,
    flowMode,
  };
  if (sessionId) submission.sessionId = sessionId;

  const phone = readOptionalString(rawBody.phone);
  const email = readOptionalString(rawBody.email);
  const message = readOptionalString(rawBody.message);
  if (phone) submission.phone = phone;
  if (email) submission.email = email;
  if (message) submission.message = message;

  const answers = readAnswers(rawBody.answers);
  if (answers) submission.answers = answers;

  const customFields = readStringRecord(rawBody.customFields);
  if (customFields) submission.customFields = customFields;

  const whatsappDestinationId = readOptionalString(rawBody.whatsappDestinationId);
  if (whatsappDestinationId) {
    submission.whatsappDestinationId = whatsappDestinationId;
  }

  if (isCustomDialogue) {
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    return { ok: true, value: submission };
  }

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
    whatsappUrl: buildWhatsAppUrl(
      chatbot,
      whatsappMessage,
      submission.whatsappDestinationId,
    ),
  };
}

export function leadToDto(lead: LeadRecord) {
  return {
    id: lead.id,
    botId: lead.botId,
    clientId: lead.clientId,
    sessionId: lead.sessionId ?? null,
    name: lead.name,
    intent: lead.intent,
    selectedExams: lead.selectedExams ?? [],
    medicalRequestStatus: lead.medicalRequestStatus ?? null,
    consultationNeed: lead.consultationNeed ?? null,
    consultationDecision: lead.consultationDecision ?? null,
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    message: lead.message ?? null,
    customFields: lead.customFields ?? null,
    answers: lead.answers ?? null,
    flowMode: lead.flowMode ?? "legacy",
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

function readAnswers(
  value: unknown,
): Record<string, string | string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) out[key] = trimmed;
      continue;
    }
    if (Array.isArray(entry)) {
      const items = entry
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length > 0) out[key] = items;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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

export function readLeadSource(value: unknown): LeadSource {
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
