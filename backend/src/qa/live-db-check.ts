import { createApp } from "../app.js";
import { getPrisma } from "../db.js";

const botId = process.env.QA_BOT_ID?.trim() || "dra-renata-reis";
const clientId = `qa-live-${Date.now()}`;
const conversionSecret = `qa-secret-${crypto.randomUUID()}`;
const prisma = getPrisma();
const app = createApp({
  conversionWebhookSecret: conversionSecret,
  trackingService: {
    async trackLeadCreated() {
      return [];
    },
  },
});

let sessionId: string | undefined;
let leadId: string | undefined;

try {
  const config = await requestJson<{ chatbot: { examOptions?: string[] } }>(
    `/api/public/chatbots/${botId}/config`,
  );
  const selectedExam = config.chatbot.examOptions?.[0];
  assert(selectedExam, `Chatbot ${botId} has no exam options for the QA flow`);

  const sessionResult = await requestJson<{ session: { id: string } }>(
    `/api/public/chatbots/${botId}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        clientId,
        source: {
          pageUrl: "https://qa.imagin.invalid/live-db",
          utm: { source: "qa-live-db", medium: "automated-check" },
        },
      }),
    },
    201,
  );
  sessionId = sessionResult.session.id;

  await appendEvent({ type: "name_captured", name: "QA Live Database" });
  const intentResult = await appendEvent({
    type: "intent_selected",
    intent: "schedule_exam",
    stepId: "intent",
    label: "Agendar exame",
  });
  assert(
    intentResult.session.status === "appointment_requested",
    "Scheduling intent did not derive appointment_requested",
  );
  await appendEvent({
    type: "answer_submitted",
    stepId: "examSelection",
    label: "Exames",
    value: [selectedExam],
  });
  await appendEvent({ type: "flow_completed", stepId: "complete" });

  const leadResult = await requestJson<{
    lead: { id: string; status: string };
  }>(
    `/api/public/chatbots/${botId}/leads`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        clientId,
        name: "QA Live Database",
        intent: "schedule_exam",
        selectedExams: [selectedExam],
        medicalRequestStatus: "Sim",
        source: {
          pageUrl: "https://qa.imagin.invalid/live-db",
          utm: { source: "qa-live-db", medium: "automated-check" },
        },
      }),
    },
    201,
  );
  leadId = leadResult.lead.id;
  assert(
    leadResult.lead.status === "appointment_requested",
    "Persisted lead did not inherit the automatic session status",
  );

  const dashboardBeforeConversion = await requestJson<{
    leads: Array<{
      id: string;
      status: string;
      sessionId: string | null;
      events: Array<{ type: string }>;
    }>;
    accesses: Array<{ id: string }>;
  }>(`/api/leads?clientId=${encodeURIComponent(clientId)}`);
  assert(dashboardBeforeConversion.accesses.length === 1, "Expected one access");
  assert(dashboardBeforeConversion.leads.length === 1, "Expected one identified lead");
  const dashboardLead = dashboardBeforeConversion.leads[0];
  assert(dashboardLead?.sessionId === sessionId, "Lead was not linked to its session");
  assert(
    dashboardLead.events.some((event) => event.type === "lead_created"),
    "Lead timeline is missing lead_created",
  );

  await requestJson(
    `/api/integrations/leads/${leadId}/converted`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${conversionSecret}` },
    },
  );
  const dashboardAfterConversion = await requestJson<{
    leads: Array<{ status: string; progress: { convertedAt: string | null } }>;
  }>(`/api/leads?clientId=${encodeURIComponent(clientId)}`);
  assert(
    dashboardAfterConversion.leads[0]?.status === "converted" &&
      Boolean(dashboardAfterConversion.leads[0]?.progress.convertedAt),
    "Trusted conversion was not reflected in the dashboard DTO",
  );

  console.log(
    `Live database QA passed for ${botId}: access, lead, timeline, status and conversion verified.`,
  );
} finally {
  if (sessionId) {
    await prisma.chatEvent.deleteMany({ where: { sessionId } });
    await prisma.chatSession.deleteMany({ where: { id: sessionId } });
  }
  await prisma.lead.deleteMany({ where: { clientId } });
  await prisma.$disconnect();
}

async function appendEvent(event: Record<string, unknown>) {
  assert(sessionId, "Session was not created");
  return requestJson<{ session: { id: string; status: string } }>(
    `/api/public/chatbots/${botId}/sessions/${sessionId}/events`,
    { method: "POST", body: JSON.stringify(event) },
  );
}

async function requestJson<T = unknown>(
  path: string,
  init: RequestInit = {},
  expectedStatus = 200,
): Promise<T> {
  const response = await app.request(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await response.json()) as T | { error?: string; issues?: string[] };
  if (response.status !== expectedStatus) {
    throw new Error(
      `Request ${path} returned ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
