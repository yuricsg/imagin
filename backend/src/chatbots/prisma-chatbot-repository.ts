import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  staticChatbotDefinitions,
  toPublicChatbotConfig,
} from "./catalog.js";
import { getConversationFlow } from "./conversation-flows.js";
import {
  defaultButtonTexts,
  defaultConsultationDecisions,
  defaultConsultationNeeds,
  defaultExamOptions,
  defaultMedicalRequestOptions,
  formatStandardWhatsAppMessage,
} from "./standard-flow.js";
import type {
  ChatbotDefinition,
  CreateChatbotInput,
  PublicChatbotConfig,
} from "./types.js";
import type { ChatbotRepository } from "./file-chatbot-repository.js";

export class PrismaChatbotRepository implements ChatbotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<ChatbotDefinition[]> {
    const rows = await this.prisma.bot.findMany();

    return [
      ...staticChatbotDefinitions,
      ...rows.map(toChatbotDefinition),
    ];
  }

  async listPublic(): Promise<PublicChatbotConfig[]> {
    return (await this.list()).map(toPublicChatbotConfig);
  }

  async get(botId: string): Promise<ChatbotDefinition | null> {
    const staticBot = staticChatbotDefinitions.find((b) => b.botId === botId);
    if (staticBot) return staticBot;

    const row = await this.prisma.bot.findUnique({ where: { id: botId } });
    return row ? toChatbotDefinition(row) : null;
  }

  async delete(botId: string): Promise<boolean> {
    try {
      await this.prisma.bot.delete({ where: { id: botId } });
      return true;
    } catch {
      return false;
    }
  }

  async update(botId: string, input: Partial<CreateChatbotInput>): Promise<PublicChatbotConfig | null> {
    const row = await this.prisma.bot.update({
      where: { id: botId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.clientId !== undefined && { clientId: input.clientId }),
        ...(input.clientName !== undefined && { clientName: input.clientName }),
        ...(input.status !== undefined && { status: normalizeStatus(input.status) }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.whatsappPhone !== undefined && { whatsappPhone: input.whatsappPhone }),
        ...(input.dashboardConfig !== undefined && {
          dashboardConfig: input.dashboardConfig as Prisma.InputJsonValue,
        }),
      },
    }).catch(() => null);
    return row ? toPublicChatbotConfig(toChatbotDefinition(row)) : null;
  }

  async create(input: CreateChatbotInput): Promise<PublicChatbotConfig> {
    const existing = await this.get(input.botId);
    if (existing) throw new Error("CHATBOT_ALREADY_EXISTS");

    const row = await this.prisma.bot.create({
      data: {
        id: input.botId,
        name: input.name,
        clientId: input.clientId,
        clientName: input.clientName,
        status: normalizeStatus(input.status),
        flowKey: getConversationFlow(input.flowKey).key,
        description: input.description ?? "",
        whatsappPhone: input.whatsappPhone ?? "",
        buttonTexts: normalizeList(input.buttonTexts, defaultButtonTexts),
        examOptions: normalizeList(input.examOptions, defaultExamOptions),
        medicalRequestOptions: normalizeList(input.medicalRequestOptions, defaultMedicalRequestOptions),
        consultationNeeds: normalizeList(input.consultationNeeds, defaultConsultationNeeds),
        consultationDecisions: normalizeList(input.consultationDecisions, defaultConsultationDecisions),
        metaPixelId: input.tracking?.meta?.pixelId ?? null,
        metaAccessToken: input.tracking?.meta?.accessToken ?? null,
        metaTestEventCode: input.tracking?.meta?.testEventCode ?? null,
        gasMeasurementId: input.tracking?.googleAnalytics?.measurementId ?? null,
        gaApiSecret: input.tracking?.googleAnalytics?.apiSecret ?? null,
        dashboardConfig: input.dashboardConfig != null
          ? (input.dashboardConfig as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return toPublicChatbotConfig(toChatbotDefinition(row));
  }
}

function toChatbotDefinition(row: Awaited<ReturnType<PrismaClient["bot"]["create"]>>): ChatbotDefinition {
  return {
    botId: row.id,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName,
    status: row.status as ChatbotDefinition["status"],
    flowKey: getConversationFlow(row.flowKey).key,
    description: row.description,
    whatsappPhone: row.whatsappPhone,
    dashboardConfig: row.dashboardConfig ?? undefined,
    tracking: {
      meta: {
        pixelId: row.metaPixelId ?? undefined,
        accessToken: row.metaAccessToken ?? undefined,
        testEventCode: row.metaTestEventCode ?? undefined,
      },
      googleAnalytics: {
        measurementId: row.gasMeasurementId ?? undefined,
        apiSecret: row.gaApiSecret ?? undefined,
      },
    },
    buttonTexts: row.buttonTexts,
    examOptions: row.examOptions,
    medicalRequestOptions: row.medicalRequestOptions,
    consultationNeeds: row.consultationNeeds,
    consultationDecisions: row.consultationDecisions,
    formatWhatsAppMessage: formatStandardWhatsAppMessage,
  };
}

function normalizeStatus(status: unknown): string {
  return status === "draft" || status === "archived" ? status : "active";
}

function normalizeList(value: unknown, fallback: string[]): string[] {
  const list = Array.isArray(value)
    ? value.filter((e): e is string => typeof e === "string").map((e) => e.trim()).filter(Boolean)
    : [];

  return list.length > 0 ? list : fallback;
}
