import type { PrismaClient } from "@prisma/client";
import type { CreateLeadRecordInput, LeadRecord } from "./types.js";
import type { LeadRepository } from "./lead-repository.js";

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<LeadRecord[]> {
    const rows = await this.prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });

    return rows.map(toLeadRecord);
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
        status: "new",
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
}

function toLeadRecord(row: Awaited<ReturnType<PrismaClient["lead"]["create"]>>): LeadRecord {
  return {
    id: row.id,
    botId: row.botId,
    clientId: row.clientId,
    name: row.name,
    intent: row.intent as LeadRecord["intent"],
    selectedExams: row.selectedExams,
    medicalRequestStatus: row.medicalRequestStatus ?? undefined,
    consultationNeed: row.consultationNeed ?? undefined,
    consultationDecision: row.consultationDecision ?? undefined,
    status: row.status as LeadRecord["status"],
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
