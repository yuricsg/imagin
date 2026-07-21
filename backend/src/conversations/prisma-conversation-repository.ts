import { Prisma, type PrismaClient } from "@prisma/client";
import { applySessionEvent } from "./session-state.js";
import type {
  ChatEventInput,
  ChatSessionRecord,
  ConversationRepository,
  CreateChatSessionInput,
  SessionListOptions,
} from "./types.js";
import type { LeadIntent, LeadSource } from "../leads/types.js";

type SessionWithEvents = Prisma.ChatSessionGetPayload<{
  include: { events: true };
}>;

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: CreateChatSessionInput): Promise<ChatSessionRecord> {
    const row = await this.prisma.chatSession.create({
      data: {
        botId: input.botId,
        clientId: input.clientId,
        source: input.source as Prisma.InputJsonValue,
        events: {
          create: {
            botId: input.botId,
            clientId: input.clientId,
            type: "chat_opened",
          },
        },
      },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    return toSessionRecord(row);
  }

  async getSession(id: string): Promise<ChatSessionRecord | null> {
    const row = await this.prisma.chatSession.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    return row ? toSessionRecord(row) : null;
  }

  async listSessions(options: SessionListOptions = {}): Promise<ChatSessionRecord[]> {
    const rows = await this.prisma.chatSession.findMany({
      where: {
        ...(options.botId ? { botId: options.botId } : {}),
        ...(options.clientId ? { clientId: options.clientId } : {}),
        ...(options.from || options.to
          ? {
              openedAt: {
                ...(options.from ? { gte: new Date(options.from) } : {}),
                ...(options.to ? { lte: new Date(options.to) } : {}),
              },
            }
          : {}),
      },
      include: { events: { orderBy: { createdAt: "asc" } } },
      orderBy: { openedAt: "desc" },
      ...(options.limit ? { take: options.limit } : {}),
    });
    return rows.map(toSessionRecord);
  }

  async appendEvent(
    sessionId: string,
    input: ChatEventInput,
  ): Promise<ChatSessionRecord | null> {
    const current = await this.getSession(sessionId);
    if (!current) return null;

    const occurredAt = new Date().toISOString();
    const next = applySessionEvent(current, input, occurredAt);
    await this.prisma.$transaction([
      this.prisma.chatEvent.create({
        data: {
          sessionId,
          botId: current.botId,
          clientId: current.clientId,
          type: input.type,
          stepId: input.stepId ?? null,
          label: input.label ?? null,
          ...(input.value !== undefined
            ? { value: input.value as Prisma.InputJsonValue }
            : {}),
        },
      }),
      this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          leadId: next.leadId ?? null,
          visitorName: next.visitorName ?? null,
          intent: next.intent ?? null,
          flowMode: next.flowMode,
          currentStep: next.currentStep ?? null,
          answers:
            Object.keys(next.answers).length > 0
              ? (next.answers as Prisma.InputJsonValue)
              : Prisma.DbNull,
          lastActivityAt: new Date(next.lastActivityAt),
          flowCompletedAt: toDate(next.flowCompletedAt),
          whatsappClickedAt: toDate(next.whatsappClickedAt),
          appointmentRequestedAt: toDate(next.appointmentRequestedAt),
          notInterestedAt: toDate(next.notInterestedAt),
          convertedAt: toDate(next.convertedAt),
        },
      }),
    ]);
    return this.getSession(sessionId);
  }

  async findByLeadId(leadId: string): Promise<ChatSessionRecord | null> {
    const row = await this.prisma.chatSession.findUnique({
      where: { leadId },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    return row ? toSessionRecord(row) : null;
  }
}

function toSessionRecord(row: SessionWithEvents): ChatSessionRecord {
  return {
    id: row.id,
    botId: row.botId,
    clientId: row.clientId,
    leadId: row.leadId ?? undefined,
    visitorName: row.visitorName ?? undefined,
    intent: isLeadIntent(row.intent) ? row.intent : undefined,
    flowMode: row.flowMode === "custom_dialogue" ? "custom_dialogue" : "legacy",
    currentStep: row.currentStep ?? undefined,
    answers: readAnswers(row.answers),
    source: readSource(row.source),
    openedAt: row.openedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    flowCompletedAt: row.flowCompletedAt?.toISOString(),
    whatsappClickedAt: row.whatsappClickedAt?.toISOString(),
    appointmentRequestedAt: row.appointmentRequestedAt?.toISOString(),
    notInterestedAt: row.notInterestedAt?.toISOString(),
    convertedAt: row.convertedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    events: row.events.map((event) => ({
      id: event.id,
      sessionId: event.sessionId,
      botId: event.botId,
      clientId: event.clientId,
      type: event.type as ChatEventInput["type"],
      stepId: event.stepId ?? undefined,
      label: event.label ?? undefined,
      value: readEventValue(event.value),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function readAnswers(value: Prisma.JsonValue | null): Record<string, string | string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") answers[key] = entry;
    if (Array.isArray(entry) && entry.every((item) => typeof item === "string")) {
      answers[key] = entry;
    }
  }
  return answers;
}

function readSource(value: Prisma.JsonValue | null): LeadSource {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LeadSource)
    : {};
}

function readEventValue(value: Prisma.JsonValue | null) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function isLeadIntent(value: string | null): value is LeadIntent {
  return (
    value === "schedule_exam" ||
    value === "schedule_consultation" ||
    value === "severe_symptoms"
  );
}

function toDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}
