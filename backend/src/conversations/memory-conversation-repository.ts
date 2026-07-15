import { randomUUID } from "node:crypto";
import { applySessionEvent } from "./session-state.js";
import type {
  ChatEventInput,
  ChatEventRecord,
  ChatSessionRecord,
  ConversationRepository,
  CreateChatSessionInput,
} from "./types.js";

export class MemoryConversationRepository implements ConversationRepository {
  private readonly sessions = new Map<string, ChatSessionRecord>();

  async createSession(input: CreateChatSessionInput): Promise<ChatSessionRecord> {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const openedEvent: ChatEventRecord = {
      id: randomUUID(),
      sessionId,
      botId: input.botId,
      clientId: input.clientId,
      type: "chat_opened",
      createdAt: now,
    };
    const session: ChatSessionRecord = {
      id: sessionId,
      botId: input.botId,
      clientId: input.clientId,
      flowMode: "legacy",
      answers: {},
      source: input.source,
      openedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      events: [openedEvent],
    };
    this.sessions.set(session.id, session);
    return cloneSession(session);
  }

  async getSession(id: string): Promise<ChatSessionRecord | null> {
    const session = this.sessions.get(id);
    return session ? cloneSession(session) : null;
  }

  async listSessions(): Promise<ChatSessionRecord[]> {
    return [...this.sessions.values()]
      .map(cloneSession)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt));
  }

  async appendEvent(
    sessionId: string,
    input: ChatEventInput,
  ): Promise<ChatSessionRecord | null> {
    const current = this.sessions.get(sessionId);
    if (!current) return null;

    const occurredAt = new Date().toISOString();
    const event: ChatEventRecord = {
      ...input,
      id: randomUUID(),
      sessionId,
      botId: current.botId,
      clientId: current.clientId,
      createdAt: occurredAt,
    };
    const next = applySessionEvent(current, input, occurredAt);
    next.events = [...current.events, event];
    this.sessions.set(sessionId, next);
    return cloneSession(next);
  }

  async findByLeadId(leadId: string): Promise<ChatSessionRecord | null> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.leadId === leadId,
    );
    return session ? cloneSession(session) : null;
  }
}

function cloneSession(session: ChatSessionRecord): ChatSessionRecord {
  return structuredClone(session);
}
