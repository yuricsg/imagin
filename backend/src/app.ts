import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { getPublicChatbotConfig, listChatbots } from "./chatbots/catalog.js";
import { FileLeadRepository } from "./leads/file-lead-repository.js";
import {
  buildLeadRecordInput,
  leadToDto,
  validateLeadSubmission,
} from "./leads/validation.js";
import type { LeadRepository } from "./leads/lead-repository.js";

export type AppOptions = {
  leadRepository?: LeadRepository;
  corsOrigins?: string[];
};

const defaultCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

export function createApp(options: AppOptions = {}) {
  const leadRepository =
    options.leadRepository ??
    new FileLeadRepository(
      process.env.LEADS_FILE_PATH ?? path.join(process.cwd(), "data", "leads.json"),
    );
  const corsOrigins = options.corsOrigins ?? readCorsOrigins();
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

  app.get("/api/public/chatbots/:botId/config", (c) => {
    const chatbot = getPublicChatbotConfig(c.req.param("botId"));

    if (!chatbot) {
      return c.json({ error: "Chatbot not found" }, 404);
    }

    return c.json({ chatbot });
  });

  app.get("/api/chatbots", (c) => {
    return c.json({ chatbots: listChatbots() });
  });

  app.post("/api/public/chatbots/:botId/leads", async (c) => {
    const rawBody = await safeReadJson(c.req.raw);
    const result = validateLeadSubmission(c.req.param("botId"), rawBody);

    if (!result.ok) {
      return c.json({ error: "Invalid lead submission", issues: result.issues }, 400);
    }

    const lead = await leadRepository.create(buildLeadRecordInput(result.value));

    return c.json(
      {
        lead: leadToDto(lead),
        whatsappMessage: lead.whatsappMessage,
        whatsappUrl: lead.whatsappUrl,
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
