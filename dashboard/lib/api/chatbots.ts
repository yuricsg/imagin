import type { Chatbot } from "@/lib/chatbots/types";
import { normalizeStoredChatbot } from "@/lib/chatbots/create";
import { slugify } from "@/lib/format";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window !== "undefined" ? "" : "http://localhost:4000");

async function apiFetch(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const hasBody = init?.body !== undefined;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${method} ${path} ${res.status}: ${text}`);
  }
  // DELETE returns { ok: true } — safe to parse as JSON
  return res.json() as Promise<Record<string, unknown>>;
}

/** Converts a dashboard Chatbot into the minimal payload the backend requires. */
function toCreatePayload(bot: Chatbot) {
  return {
    botId: bot.id,
    name: bot.name,
    clientId: bot.clientId,
    clientName: bot.clientName,
    status: bot.status === "error" ? "draft" : bot.status,
    flowKey: "cardiology_exam_consultation",
    description: bot.specialty,
    whatsappPhone: bot.whatsapp.enabled ? bot.whatsapp.phoneNumber : "",
    tracking: {
      meta: { pixelId: bot.tracking.metaPixelId || undefined },
      googleAnalytics: {
        measurementId: bot.tracking.gaMeasurementId || undefined,
      },
    },
    buttonTexts: [],
    examOptions: [],
    medicalRequestOptions: [],
    consultationNeeds: [],
    consultationDecisions: [],
    dashboardConfig: bot,
  };
}

/** Creates a bot on the backend. Returns the saved Chatbot (from dashboardConfig). */
export async function apiCreateChatbot(bot: Chatbot): Promise<Chatbot> {
  const data = await apiFetch("/api/chatbots", {
    method: "POST",
    body: JSON.stringify(toCreatePayload(bot)),
  });
  return extractChatbot(data, bot);
}

/** Updates a bot on the backend. Returns the saved Chatbot. */
export async function apiUpdateChatbot(bot: Chatbot): Promise<Chatbot> {
  const data = await apiFetch(`/api/chatbots/${bot.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: bot.name,
      clientId: bot.clientId,
      clientName: bot.clientName,
      status: bot.status === "error" ? "draft" : bot.status,
      description: bot.specialty,
      whatsappPhone: bot.whatsapp.enabled ? bot.whatsapp.phoneNumber : "",
      dashboardConfig: bot,
    }),
  });
  return extractChatbot(data, bot);
}

/** Fetches all dashboard bots from the backend and normalizes them. */
export async function apiListChatbots(): Promise<Chatbot[]> {
  const data = await apiFetch("/api/chatbots");
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