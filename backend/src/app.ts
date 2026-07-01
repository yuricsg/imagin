import { Hono } from "hono";
import { cors } from "hono/cors";
import { toPublicChatbotConfig } from "./chatbots/catalog.js";
import { getConversationFlow } from "./chatbots/conversation-flows.js";
import { PrismaChatbotRepository } from "./chatbots/prisma-chatbot-repository.js";
import { PrismaLeadRepository } from "./leads/prisma-lead-repository.js";
import { getPrisma } from "./db.js";
import {
  buildLeadRecordInput,
  leadToDto,
  validateLeadSubmission,
} from "./leads/validation.js";
import { createTrackingService } from "./tracking/tracking-service.js";
import type { ChatbotRepository } from "./chatbots/file-chatbot-repository.js";
import type { CreateChatbotInput } from "./chatbots/types.js";
import type { LeadRepository } from "./leads/lead-repository.js";
import type { TrackingService } from "./tracking/types.js";

export type AppOptions = {
  chatbotRepository?: ChatbotRepository;
  leadRepository?: LeadRepository;
  trackingService?: TrackingService;
  corsOrigins?: string[];
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
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
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

  app.get("/api/public/chatbots/:botId/config", async (c) => {
    const chatbot = await chatbotRepository.get(c.req.param("botId"));

    if (!chatbot) {
      return c.json({ error: "Chatbot not found" }, 404);
    }

    return c.json({ chatbot: toPublicChatbotConfig(chatbot) });
  });

  app.get("/api/chatbots", async (c) => {
    return c.json({ chatbots: await chatbotRepository.listPublic() });
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

    const lead = await leadRepository.create(
      buildLeadRecordInput(result.value, chatbot),
    );
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
    const leads = await leadRepository.list();

    return c.json({
      leads: leads
        .filter((lead) => !botId || lead.botId === botId)
        .filter((lead) => !clientId || lead.clientId === clientId)
        .map(leadToDto)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    });
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
    },
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
