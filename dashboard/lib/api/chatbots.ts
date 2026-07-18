import type { Chatbot } from "@/lib/chatbots/types";
import { normalizeStoredChatbot } from "@/lib/chatbots/create";
import { slugify } from "@/lib/format";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window !== "undefined" ? "" : "http://localhost:4000");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Backoff between attempts — sized to ride out a Render free-tier cold start. */
const RETRY_DELAYS_MS = [2000, 5000, 10000];

/** 5xx and network errors are transient (sleeping backend); 4xx are not. */
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  apiBase = API_BASE,
  { retries = 0 }: { retries?: number } = {},
) {
  const method = init?.method ?? "GET";
  const hasBody = init?.body !== undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const error = new Error(`API ${method} ${path} ${res.status}: ${text}`);
        // Retry a waking backend, but fail fast on a real 4xx.
        if (attempt < retries && isTransientStatus(res.status)) {
          lastError = error;
          await sleep(RETRY_DELAYS_MS[attempt] ?? 10000);
          continue;
        }
        throw error;
      }
      // DELETE returns { ok: true } — safe to parse as JSON
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      // Network failure (backend unreachable/cold) — also worth retrying.
      lastError = err;
      if (attempt < retries) {
        await sleep(RETRY_DELAYS_MS[attempt] ?? 10000);
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("API request failed");
}

/** Picks the backend conversation flow that matches the dashboard template. */
function flowKeyForTemplate(templateId: Chatbot["flow"]["templateId"]): string {
  switch (templateId) {
    case "exam-scheduling":
      return "exam_scheduling";
    case "appointment":
      return "consultation_scheduling";
    case "triage":
      return "urgent_triage";
    default:
      return "cardiology_exam_consultation";
  }
}

/** Converts a dashboard Chatbot into the minimal payload the backend requires. */
function toCreatePayload(bot: Chatbot) {
  const teaserTexts =
    bot.launcher?.teaserTexts?.filter((t) => t.trim()).length > 0
      ? bot.launcher.teaserTexts.map((t) => t.trim()).filter(Boolean)
      : ["Olá! Posso te ajudar?"];
  return {
    botId: bot.id,
    name: bot.name,
    clientId: bot.clientId,
    clientName: bot.clientName,
    status: bot.status === "error" ? "draft" : bot.status,
    flowKey: flowKeyForTemplate(bot.flow.templateId),
    description: bot.specialty,
    whatsappPhone: bot.whatsapp.enabled ? bot.whatsapp.phoneNumber : "",
    tracking: {
      meta: { pixelId: bot.tracking.metaPixelId || undefined },
      googleAnalytics: {
        measurementId: bot.tracking.gaMeasurementId || undefined,
      },
    },
    buttonTexts: teaserTexts,
    // The clinic's configured services drive both branches of the widget flow:
    // exam scheduling (examOptions) and consultation needs (consultationNeeds).
    examOptions: bot.flow.services,
    medicalRequestOptions: [],
    consultationNeeds: bot.flow.services,
    consultationDecisions: [],
    avatarUrl: bot.launcher?.avatarUrl ?? null,
    dashboardConfig: bot,
  };
}

/** Creates a bot on the backend. Returns the saved Chatbot (from dashboardConfig). */
export async function apiCreateChatbot(bot: Chatbot): Promise<Chatbot> {
  const data = await apiFetch(
    "/api/chatbots",
    { method: "POST", body: JSON.stringify(toCreatePayload(bot)) },
    undefined,
    { retries: RETRY_DELAYS_MS.length },
  );
  return extractChatbot(data, bot);
}

/** Updates a bot on the backend. Returns the saved Chatbot. */
export async function apiUpdateChatbot(bot: Chatbot): Promise<Chatbot> {
  const teaserTexts =
    bot.launcher?.teaserTexts?.filter((t) => t.trim()).length > 0
      ? bot.launcher.teaserTexts.map((t) => t.trim()).filter(Boolean)
      : ["Olá! Posso te ajudar?"];
  const data = await apiFetch(
    `/api/chatbots/${bot.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        name: bot.name,
        clientId: bot.clientId,
        clientName: bot.clientName,
        status: bot.status === "error" ? "draft" : bot.status,
        flowKey: flowKeyForTemplate(bot.flow.templateId),
        description: bot.specialty,
        whatsappPhone: bot.whatsapp.enabled ? bot.whatsapp.phoneNumber : "",
        buttonTexts: teaserTexts,
        examOptions: bot.flow.services,
        consultationNeeds: bot.flow.services,
        avatarUrl: bot.launcher?.avatarUrl ?? null,
        dashboardConfig: bot,
      }),
    },
    undefined,
    { retries: RETRY_DELAYS_MS.length },
  );
  return extractChatbot(data, bot);
}

/** Fetches all dashboard bots from the backend and normalizes them. */
export async function apiListChatbots(apiBase?: string): Promise<Chatbot[]> {
  const data = await apiFetch("/api/chatbots", undefined, apiBase ?? API_BASE);
  const list = Array.isArray(data.chatbots) ? data.chatbots : [];
  const bots: Chatbot[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const config = record.dashboardConfig;
    if (config) {
      const normalized = normalizeStoredChatbot(config);
      if (normalized) {
        bots.push(normalized);
        continue;
      }
    }
    // Fallback: build a minimal Chatbot from backend fields
    if (typeof record.botId !== "string") continue;
    const fallback = normalizeStoredChatbot({
      id: record.botId,
      name: record.name ?? record.botId,
      clientId: record.clientId ?? slugify(String(record.clientName ?? record.botId)),
      clientName: record.clientName ?? record.botId,
      status: record.status ?? "active",
      specialty: record.description ?? "",
      accent: "indigo",
      createdAt: new Date().toISOString(),
    });
    if (fallback) bots.push(fallback);
  }
  return bots;
}

/** Deletes a bot from the backend. Returns true on success. */
export async function apiDeleteChatbot(botId: string): Promise<boolean> {
  try {
    await apiFetch(`/api/chatbots/${botId}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.error("apiDeleteChatbot failed:", err);
    return false;
  }
}

function extractChatbot(
  data: Record<string, unknown>,
  fallback: Chatbot,
): Chatbot {
  const record =
    data.chatbot && typeof data.chatbot === "object"
      ? (data.chatbot as Record<string, unknown>)
      : null;
  const config = record?.dashboardConfig;
  if (config) {
    const normalized = normalizeStoredChatbot(config);
    if (normalized) return normalized;
  }
  return fallback;
}
