import { Prisma, type PrismaClient } from "@prisma/client";
import type { CreateLeadRecordInput, LeadRecord } from "./types.js";
import type { LeadListOptions, LeadRepository } from "./lead-repository.js";
import {
  deriveSubmittedLeadStatus,
  normalizePersistedLeadStatus,
} from "./lead-status.js";

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(options: LeadListOptions = {}): Promise<LeadRecord[]> {
    const rows = await this.prisma.lead.findMany({
      where: {
        ...(options.botId ? { botId: options.botId } : {}),
        ...(options.clientId ? { clientId: options.clientId } : {}),
        ...(options.from || options.to
          ? {
              createdAt: {
                ...(options.from ? { gte: new Date(options.from) } : {}),
                ...(options.to ? { lte: new Date(options.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      ...(options.limit ? { take: options.limit } : {}),
    });

    return rows.map(toLeadRecord);
  }

  async findById(id: string): Promise<LeadRecord | null> {
    const row = await this.prisma.lead.findUnique({ where: { id } });
    return row ? toLeadRecord(row) : null;
  }

  async create(input: CreateLeadRecordInput): Promise<LeadRecord> {
    const row = await this.prisma.lead.create({
      data: {
        botId: input.botId,
        clientId: input.clientId,
        name: input.name,
        intent: input.intent,
        selectedExams: input.selectedExams ?? [],
        medicalRequestStatus: input.medicalRequestStatus ?? null,
        consultationNeed: input.consultationNeed ?? null,
        consultationDecision: input.consultationDecision ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        message: input.message ?? null,
        ...(input.customFields
          ? { customFields: input.customFields as Prisma.InputJsonValue }
          : {}),
        ...(input.answers
          ? { answers: input.answers as Prisma.InputJsonValue }
          : {}),
        flowMode: input.flowMode ?? "legacy",
        whatsappDestinationId: input.whatsappDestinationId ?? null,
        sessionId: input.sessionId ?? null,
        status: deriveSubmittedLeadStatus(input),
        whatsappMessage: input.whatsappMessage,
        whatsappUrl: input.whatsappUrl,
        pageUrl: input.source.pageUrl ?? null,
        landingPageUrl: input.source.landingPageUrl ?? null,
        referrer: input.source.referrer ?? null,
        parentOrigin: input.source.parentOrigin ?? null,
        utmSource: input.source.utm?.source ?? null,
        utmMedium: input.source.utm?.medium ?? null,
        utmCampaign: input.source.utm?.campaign ?? null,
        utmContent: input.source.utm?.content ?? null,
        utmTerm: input.source.utm?.term ?? null,
        utmId: input.source.utm?.id ?? null,
        fbclid: input.source.clickIds?.fbclid ?? null,
        gclid: input.source.clickIds?.gclid ?? null,
        fbp: input.source.cookies?.fbp ?? null,
        fbc: input.source.cookies?.fbc ?? null,
        gaClientId: input.source.cookies?.gaClientId ?? null,
      },
    });

    return toLeadRecord(row);
  }

  async updateStatus(
    id: string,
    status: LeadRecord["status"],
  ): Promise<LeadRecord | null> {
    const existing = await this.prisma.lead.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.prisma.lead.update({
      where: { id },
      data: { status },
    });
    return toLeadRecord(row);
  }
}

function toLeadRecord(row: Awaited<ReturnType<PrismaClient["lead"]["create"]>>): LeadRecord {
  return {
    id: row.id,
    botId: row.botId,
    clientId: row.clientId,
    sessionId: row.sessionId ?? undefined,
    name: row.name,
    intent: row.intent as LeadRecord["intent"],
    selectedExams: row.selectedExams,
    medicalRequestStatus: row.medicalRequestStatus ?? undefined,
    consultationNeed: row.consultationNeed ?? undefined,
    consultationDecision: row.consultationDecision ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    message: row.message ?? undefined,
    customFields: readStringRecord(row.customFields),
    answers: readAnswers(row.answers),
    flowMode: row.flowMode === "custom_dialogue" ? "custom_dialogue" : "legacy",
    whatsappDestinationId: row.whatsappDestinationId ?? undefined,
    status: normalizePersistedLeadStatus(row.status),
    whatsappMessage: row.whatsappMessage,
    whatsappUrl: row.whatsappUrl,
    source: {
      pageUrl: row.pageUrl ?? undefined,
      landingPageUrl: row.landingPageUrl ?? undefined,
      referrer: row.referrer ?? undefined,
      parentOrigin: row.parentOrigin ?? undefined,
      utm: {
        source: row.utmSource ?? undefined,
        medium: row.utmMedium ?? undefined,
        campaign: row.utmCampaign ?? undefined,
        content: row.utmContent ?? undefined,
        term: row.utmTerm ?? undefined,
        id: row.utmId ?? undefined,
      },
      clickIds: {
        fbclid: row.fbclid ?? undefined,
        gclid: row.gclid ?? undefined,
      },
      cookies: {
        fbp: row.fbp ?? undefined,
        fbc: row.fbc ?? undefined,
        gaClientId: row.gaClientId ?? undefined,
      },
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function readStringRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function readAnswers(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
    if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      result[key] = entry;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
