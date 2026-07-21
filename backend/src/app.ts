import { Hono } from "hono";
import { cors } from "hono/cors";
import { timingSafeEqual } from "node:crypto";
import { toPublicChatbotConfig } from "./chatbots/catalog.js";
import { getConversationFlow } from "./chatbots/conversation-flows.js";
import { PrismaChatbotRepository } from "./chatbots/prisma-chatbot-repository.js";
import { PrismaLeadRepository } from "./leads/prisma-lead-repository.js";
import { MemoryConversationRepository } from "./conversations/memory-conversation-repository.js";
import { PrismaConversationRepository } from "./conversations/prisma-conversation-repository.js";
import { deriveAutomaticLeadStatus } from "./conversations/session-state.js";
import {
  CHAT_EVENT_TYPES,
  type ChatEventInput,
  type ConversationRepository,
} from "./conversations/types.js";
import { getPrisma } from "./db.js";
import { UserRepository } from "./users/user-repository.js";
import {
  buildLeadRecordInput,
  leadToDto,
  readLeadSource,
  validateLeadSubmission,
} from "./leads/validation.js";
import { leadToDashboardDto } from "./leads/dashboard-dto.js";
import { createTrackingService } from "./tracking/tracking-service.js";
import type { ChatbotRepository } from "./chatbots/file-chatbot-repository.js";
import type { CreateChatbotInput } from "./chatbots/types.js";
import type { LeadRepository } from "./leads/lead-repository.js";
import type { TrackingService } from "./tracking/types.js";

export type AppOptions = {
  chatbotRepository?: ChatbotRepository;
  leadRepository?: LeadRepository;
  trackingService?: TrackingService;
  conversationRepository?: ConversationRepository;
  userRepository?: UserRepository;
  corsOrigins?: string[];
  conversionWebhookSecret?: string;
};

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

export function createApp(options: AppOptions = {}) {
  const prisma = options.chatbotRepository && options.leadRepository
    ? null
    : getPrisma();
  const chatbotRepository =
    options.chatbotRepository ?? new PrismaChatbotRepository(prisma!);
  const leadRepository =
    options.leadRepository ?? new PrismaLeadRepository(prisma!);
  const conversationRepository =
    options.conversationRepository ??
    (prisma
      ? new PrismaConversationRepository(prisma)
      : new MemoryConversationRepository());
  const userRepository =
    options.userRepository ??
    (prisma ? new UserRepository(prisma) : null);
  const corsOrigins = options.corsOrigins ?? readCorsOrigins();
  const trackingService = options.trackingService ?? createTrackingService();
  const app = new Hono();

  app.use(
    "/api/*",
    cors({
      origin: (origin) => {
        if (!origin || isAllowedOrigin(origin, corsOrigins)) {
          return origin || corsOrigins[0] || "*";
        }

        return corsOrigins[0] || "*";
      },
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );

  app.get("/", (c) => {
    return c.json({
      service: "imagin-backend",
      status: "ok",
    });
  });

  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Credential check for the dashboard's NextAuth Credentials provider. Called
  // server-to-server by Next.js — returns the user on success, 401 otherwise.
  app.post("/api/auth/login", async (c) => {
    if (!userRepository) {
      return c.json({ error: "auth is not configured" }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const email =
      typeof (body as Record<string, unknown>)?.email === "string"
        ? ((body as Record<string, unknown>).email as string)
        : "";
    const password =
      typeof (body as Record<string, unknown>)?.password === "string"
        ? ((body as Record<string, unknown>).password as string)
        : "";
    if (!email || !password) {
      return c.json({ error: "email and password are required" }, 400);
    }
    const user = await userRepository.verifyCredentials(email, password);
    if (!user) {
      return c.json({ error: "invalid credentials" }, 401);
    }
    return c.json({ user });
  });

  // Command-palette pins (⌘K), per operator. The dashboard is already behind
  // its login; the operator's own email scopes these preference reads/writes.
  app.get("/api/users/pinned-commands", async (c) => {
    if (!userRepository) {
      return c.json({ error: "auth is not configured" }, 503);
    }
    const email = c.req.query("email");
    if (!email) {
      return c.json({ error: "email is required" }, 400);
    }
    const commandIds = await userRepository.getPinnedCommands(email);
    return c.json({ commandIds });
  });

  app.put("/api/users/pinned-commands", async (c) => {
    if (!userRepository) {
      return c.json({ error: "auth is not configured" }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const record = body as Record<string, unknown>;
    const email = typeof record?.email === "string" ? record.email : "";
    if (!email) {
      return c.json({ error: "email is required" }, 400);
    }
    const commandIds = Array.isArray(record?.commandIds)
      ? record.commandIds.filter((id): id is string => typeof id === "string")
      : [];
    const saved = await userRepository.setPinnedCommands(email, commandIds);
    if (saved === null) {
      return c.json({ error: "unknown user" }, 404);
    }
    return c.json({ commandIds: saved });
  });

  app.get("/api/public/chatbots/:botId/config", async (c) => {
    const chatbot = await chatbotRepository.get(c.req.param("botId"));

    if (!chatbot) {
      return c.json({ error: "Chatbot not found" }, 404);
    }

    c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return c.json({ chatbot: toPublicChatbotConfig(chatbot) });
  });

  app.post("/api/public/chatbots/:botId/sessions", async (c) => {
    const botId = c.req.param("botId");
    const chatbot = await chatbotRepository.get(botId);
    if (!chatbot) return c.json({ error: "Chatbot not found" }, 404);

    const rawBody = await safeReadJson(c.req.raw);
    if (!isRecord(rawBody)) return c.json({ error: "Invalid body" }, 400);
    const clientId = readOptionalString(rawBody.clientId);
    if (!clientId) return c.json({ error: "clientId is required" }, 400);

    const session = await conversationRepository.createSession({
      botId,
      clientId,
      source: readLeadSource(rawBody.source),
    });
    return c.json(
      {
        session: {
          id: session.id,
          botId: session.botId,
          clientId: session.clientId,
          openedAt: session.openedAt,
          status: deriveAutomaticLeadStatus(session),
        },
      },
      201,
    );
  });

  app.post("/api/public/chatbots/:botId/sessions/:sessionId/events", async (c) => {
    const session = await conversationRepository.getSession(c.req.param("sessionId"));
    if (!session || session.botId !== c.req.param("botId")) {
      return c.json({ error: "Chat session not found" }, 404);
    }

    const eventResult = readPublicChatEvent(await safeReadJson(c.req.raw));
    if (!eventResult.ok) {
      return c.json({ error: "Invalid chat event", issues: eventResult.issues }, 400);
    }

    const updated = await conversationRepository.appendEvent(session.id, eventResult.value);
    if (!updated) return c.json({ error: "Chat session not found" }, 404);
    const status = deriveAutomaticLeadStatus(updated);
    if (updated.leadId) {
      await leadRepository.updateStatus(updated.leadId, status);
    }
    return c.json({ session: { id: updated.id, status, updatedAt: updated.updatedAt } });
  });

  app.get("/api/chatbots", async (c) => {
    return c.json({ chatbots: await chatbotRepository.listPublic() });
  });

  app.delete("/api/chatbots/:botId", async (c) => {
    const botId = c.req.param("botId");
    const repo = chatbotRepository as PrismaChatbotRepository;
    if (typeof repo.delete !== "function") {
      return c.json({ error: "Not supported" }, 501);
    }
    const deleted = await repo.delete(botId);
    if (!deleted) return c.json({ error: "Chatbot not found" }, 404);
    return c.json({ ok: true });
  });

  app.put("/api/chatbots/:botId", async (c) => {
    const botId = c.req.param("botId");
    const rawBody = await safeReadJson(c.req.raw);
    if (!isRecord(rawBody)) {
      return c.json({ error: "Invalid body" }, 400);
    }
    const dashboardConfig = rawBody.dashboardConfig;
    const repo = chatbotRepository as PrismaChatbotRepository;
    if (typeof repo.update !== "function") {
      return c.json({ error: "Not supported" }, 501);
    }
    const chatbot = await repo.update(botId, {
      name: typeof rawBody.name === "string" ? rawBody.name : undefined,
      clientId: typeof rawBody.clientId === "string" ? rawBody.clientId : undefined,
      clientName: typeof rawBody.clientName === "string" ? rawBody.clientName : undefined,
      status: readStatus(rawBody.status),
      flowKey:
        rawBody.flowKey !== undefined
          ? getConversationFlow(rawBody.flowKey).key
          : undefined,
      description: typeof rawBody.description === "string" ? rawBody.description : undefined,
      whatsappPhone: typeof rawBody.whatsappPhone === "string" ? rawBody.whatsappPhone : undefined,
      buttonTexts: Array.isArray(rawBody.buttonTexts)
        ? readStringList(rawBody.buttonTexts)
        : undefined,
      avatarUrl:
        rawBody.avatarUrl !== undefined
          ? readAvatarUrl(rawBody.avatarUrl)
          : undefined,
      examOptions: Array.isArray(rawBody.examOptions)
        ? readStringList(rawBody.examOptions)
        : undefined,
      consultationNeeds: Array.isArray(rawBody.consultationNeeds)
        ? readStringList(rawBody.consultationNeeds)
        : undefined,
      dashboardConfig,
    });
    if (!chatbot) return c.json({ error: "Chatbot not found" }, 404);
    return c.json({ chatbot });
  });

  app.post("/api/chatbots", async (c) => {
    const rawBody = await safeReadJson(c.req.raw);
    const result = validateCreateChatbot(rawBody);

    if (!result.ok) {
      return c.json({ error: "Invalid chatbot", issues: result.issues }, 400);
    }

    try {
      const chatbot = await chatbotRepository.create(result.value);

      return c.json({ chatbot }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "CHATBOT_ALREADY_EXISTS") {
        return c.json({ error: "Chatbot already exists" }, 409);
      }

      throw error;
    }
  });

  app.post("/api/public/chatbots/:botId/leads", async (c) => {
    const rawBody = await safeReadJson(c.req.raw);
    const chatbot = await chatbotRepository.get(c.req.param("botId"));

    if (!chatbot) {
      return c.json({ error: "Chatbot not found" }, 404);
    }

    const result = validateLeadSubmission(c.req.param("botId"), rawBody, chatbot);

    if (!result.ok) {
      return c.json({ error: "Invalid lead submission", issues: result.issues }, 400);
    }

    const session = result.value.sessionId
      ? await conversationRepository.getSession(result.value.sessionId)
      : null;
    if (
      result.value.sessionId &&
      (!session || session.botId !== chatbot.botId || session.clientId !== result.value.clientId)
    ) {
      return c.json({ error: "Invalid chat session" }, 400);
    }
    if (session?.leadId) {
      const existing = await leadRepository.findById(session.leadId);
      if (existing) {
        return c.json({
          lead: leadToDto(existing),
          whatsappMessage: existing.whatsappMessage,
          whatsappUrl: existing.whatsappUrl,
          tracking: [],
        });
      }
    }

    let lead = await leadRepository.create(
      buildLeadRecordInput(result.value, chatbot),
    );
    if (session) {
      const updatedSession = await conversationRepository.appendEvent(session.id, {
        type: "lead_created",
        leadId: lead.id,
      });
      if (updatedSession) {
        const status = deriveAutomaticLeadStatus(updatedSession);
        lead = (await leadRepository.updateStatus(lead.id, status)) ?? lead;
      }
    }
    const tracking = await trackingService.trackLeadCreated(lead, chatbot, {
      ipAddress: getRequestIp(c.req.raw),
      userAgent: c.req.header("user-agent") ?? undefined,
    });

    return c.json(
      {
        lead: leadToDto(lead),
        whatsappMessage: lead.whatsappMessage,
        whatsappUrl: lead.whatsappUrl,
        tracking,
      },
      201,
    );
  });

  app.get("/api/leads", async (c) => {
    const botId = c.req.query("botId");
    const clientId = c.req.query("clientId");
    const from = readDateQuery(c.req.query("from"));
    const to = readDateQuery(c.req.query("to"), true);
    const limit = readLimitQuery(c.req.query("limit"));
    if (from === null || to === null || limit === null) {
      return c.json({ error: "invalid from, to or limit query" }, 400);
    }
    const listOptions = {
      ...(botId ? { botId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(limit ? { limit } : {}),
    };
    const [leads, sessions] = await Promise.all([
      leadRepository.list(listOptions),
      conversationRepository.listSessions(listOptions),
    ]);
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
    const sessionLeadIds = new Set<string>();
    const dashboardLeads = sessions
      .filter((session) => Boolean(session.visitorName?.trim()))
      .map((session) => {
        const lead = session.leadId ? leadsById.get(session.leadId) : undefined;
        if (lead) sessionLeadIds.add(lead.id);
        return leadToDashboardDto(lead, session);
      });
    for (const lead of leads) {
      if (!sessionLeadIds.has(lead.id)) {
        dashboardLeads.push(leadToDashboardDto(lead));
      }
    }

    const sortedLeads = dashboardLeads.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    return c.json({
      leads: limit ? sortedLeads.slice(0, limit) : sortedLeads,
      accesses: sessions
        .map((session) => ({
          id: session.id,
          botId: session.botId,
          clientId: session.clientId,
          openedAt: session.openedAt,
          // Lets the dashboard attribute accesses to a channel, the same way
          // leads are attributed — required for per-channel conversion rates.
          source: session.source,
        })),
    });
  });

  app.post("/api/integrations/leads/:leadId/converted", async (c) => {
    const secret =
      options.conversionWebhookSecret ?? process.env.CONVERSION_WEBHOOK_SECRET;
    if (!secret) {
      return c.json({ error: "Conversion webhook is not configured" }, 503);
    }
    if (!matchesBearerToken(c.req.header("authorization"), secret)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const lead = await leadRepository.updateStatus(
      c.req.param("leadId"),
      "converted",
    );
    if (!lead) return c.json({ error: "Lead not found" }, 404);
    const session = await conversationRepository.findByLeadId(lead.id);
    if (session) {
      await conversationRepository.appendEvent(session.id, {
        type: "conversion_confirmed",
      });
    }
    return c.json({ lead: leadToDto(lead), status: "converted" });
  });

  return app;
}

async function safeReadJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readCorsOrigins() {
  const configured = process.env.CORS_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured?.length ? configured : defaultCorsOrigins;
}

function isAllowedOrigin(origin: string, corsOrigins: string[]) {
  return (
    corsOrigins.includes(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    undefined
  );
}

type CreateChatbotValidationResult =
  | { ok: true; value: CreateChatbotInput }
  | { ok: false; issues: string[] };

function validateCreateChatbot(rawBody: unknown): CreateChatbotValidationResult {
  const issues: string[] = [];

  if (!isRecord(rawBody)) {
    return { ok: false, issues: ["body must be a JSON object"] };
  }

  const botId = readRequiredString(rawBody, "botId", issues);
  const name = readRequiredString(rawBody, "name", issues);
  const clientId = readRequiredString(rawBody, "clientId", issues);
  const clientName = readRequiredString(rawBody, "clientName", issues);
  const status = readStatus(rawBody.status);
  const flowKey = getConversationFlow(rawBody.flowKey).key;
  const description = readOptionalString(rawBody.description);
  const whatsappPhone = readOptionalString(rawBody.whatsappPhone);
  const tracking = readTracking(rawBody.tracking);
  const buttonTexts = readStringList(rawBody.buttonTexts);
  const examOptions = readStringList(rawBody.examOptions);
  const medicalRequestOptions = readStringList(rawBody.medicalRequestOptions);
  const consultationNeeds = readStringList(rawBody.consultationNeeds);
  const consultationDecisions = readStringList(rawBody.consultationDecisions);
  const avatarUrl = readAvatarUrl(rawBody.avatarUrl);
  const dashboardConfig = rawBody.dashboardConfig;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(botId)) {
    issues.push("botId must be a lowercase slug");
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: {
      botId,
      name,
      clientId,
      clientName,
      status,
      flowKey,
      description,
      whatsappPhone,
      tracking,
      buttonTexts,
      examOptions,
      medicalRequestOptions,
      consultationNeeds,
      consultationDecisions,
      avatarUrl,
      dashboardConfig,
    },
  };
}

/** Accepts a data URL / http(s) / preset path avatar, or null to clear it. */
function readAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readTracking(value: unknown): CreateChatbotInput["tracking"] {
  if (!isRecord(value)) {
    return {};
  }

  const meta = isRecord(value.meta) ? value.meta : {};
  const googleAnalytics = isRecord(value.googleAnalytics)
    ? value.googleAnalytics
    : {};

  return {
    meta: {
      pixelId: readOptionalString(meta.pixelId),
      accessToken: readOptionalString(meta.accessToken),
      testEventCode: readOptionalString(meta.testEventCode),
    },
    googleAnalytics: {
      measurementId: readOptionalString(googleAnalytics.measurementId),
      apiSecret: readOptionalString(googleAnalytics.apiSecret),
    },
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

function readDateQuery(
  value: string | undefined,
  endOfDay = false,
): string | undefined | null {
  if (!value) return undefined;
  const normalized =
    endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T23:59:59.999Z`
      : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function readLimitQuery(value: string | undefined): number | undefined | null {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 500 ? parsed : null;
}

function readStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function readStatus(value: unknown): CreateChatbotInput["status"] {
  return value === "draft" || value === "archived" ? value : "active";
}

type PublicChatEventResult =
  | { ok: true; value: ChatEventInput }
  | { ok: false; issues: string[] };

const PUBLIC_CHAT_EVENT_TYPES = new Set([
  "name_captured",
  "intent_selected",
  "answer_submitted",
  "flow_completed",
  "whatsapp_clicked",
]);

function readPublicChatEvent(value: unknown): PublicChatEventResult {
  if (!isRecord(value)) return { ok: false, issues: ["body must be a JSON object"] };
  const type = readOptionalString(value.type);
  if (!CHAT_EVENT_TYPES.has(type as ChatEventInput["type"]) || !PUBLIC_CHAT_EVENT_TYPES.has(type)) {
    return { ok: false, issues: ["event type is not allowed"] };
  }

  const event: ChatEventInput = { type: type as ChatEventInput["type"] };
  const stepId = readOptionalString(value.stepId);
  const label = readOptionalString(value.label);
  const name = readOptionalString(value.name);
  const intent = readLeadIntent(value.intent);
  const eventValue = readChatEventValue(value.value);
  if (stepId) event.stepId = stepId;
  if (label) event.label = label;
  if (name) event.name = name;
  if (intent) event.intent = intent;
  if (eventValue !== undefined) event.value = eventValue;
  if (value.flowMode === "custom_dialogue") event.flowMode = "custom_dialogue";
  if (event.type === "name_captured" && !event.name) {
    return { ok: false, issues: ["name is required"] };
  }
  if (event.type === "intent_selected" && !event.intent) {
    return { ok: false, issues: ["intent is required"] };
  }
  return { ok: true, value: event };
}

function readLeadIntent(value: unknown) {
  return value === "schedule_exam" ||
    value === "schedule_consultation" ||
    value === "severe_symptoms"
    ? value
    : undefined;
}

function readChatEventValue(value: unknown): ChatEventInput["value"] {
  if (typeof value === "string") return value.trim().slice(0, 2_000);
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 50);
  }
  return undefined;
}

function matchesBearerToken(authorization: string | undefined, expected: string) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const actual = authorization.slice(7);
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
