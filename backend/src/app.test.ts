import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "./app.js";
import { FileChatbotRepository } from "./chatbots/file-chatbot-repository.js";
import { FileLeadRepository } from "./leads/file-lead-repository.js";
import type { TrackingService } from "./tracking/types.js";

const noOpTrackingService: TrackingService = {
  async trackLeadCreated() {
    return [
      { provider: "meta", status: "skipped", reason: "test" },
      { provider: "google_analytics", status: "skipped", reason: "test" },
    ];
  },
};

test("creates and lists an exam lead", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });

    const createResponse = await app.request("/api/public/chatbots/dra-renata-reis/leads", {
      method: "POST",
      body: JSON.stringify({
        clientId: "clinica-renata",
        name: "Teste",
        intent: "schedule_exam",
        selectedExams: [
          "Parecer cardiológico - pré operatório",
          "Ecocardiograma fetal",
          "Polissonografia tipo 3",
        ],
        medicalRequestStatus: "Tenho dúvidas",
        source: {
          pageUrl: "https://cliente.example/agendar",
          landingPageUrl: "https://cliente.example/?utm_source=google",
          referrer: "https://google.com",
          parentOrigin: "https://cliente.example",
          utm: {
            source: "google",
            medium: "cpc",
            campaign: "cardio",
          },
          clickIds: {
            gclid: "test-gclid",
          },
          cookies: {
            gaClientId: "123.456",
          },
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    assert.equal(createResponse.status, 201);

    const created = await createResponse.json();
    assert.equal(created.lead.name, "Teste");
    assert.equal(created.lead.intent, "schedule_exam");
    assert.equal(created.lead.source.utm.source, "google");
    assert.equal(created.lead.source.clickIds.gclid, "test-gclid");
    assert.equal(created.tracking[0].provider, "meta");
    assert.match(
      created.whatsappMessage,
      /Ainda tenho dúvidas: Parecer cardiológico - pré operatório, Ecocardiograma fetal, Polissonografia tipo 3/,
    );

    const listResponse = await app.request("/api/leads");
    const listed = await listResponse.json();

    assert.equal(listed.leads.length, 1);
    assert.equal(listed.leads[0].clientId, "clinica-renata");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("rejects missing required lead fields", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });
    const response = await app.request("/api/public/chatbots/dra-renata-reis/leads", {
      method: "POST",
      body: JSON.stringify({ intent: "schedule_exam" }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.issues.includes("name is required"));
    assert.ok(body.issues.includes("clientId is required"));
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("allows localhost dashboard ports during development", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });
    const response = await app.request("/api/leads", {
      headers: new Headers({ Origin: "http://localhost:3002" }),
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:3002",
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("lists configured chatbots and filters leads by bot", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });

    const chatbotsResponse = await app.request("/api/chatbots");
    const chatbotsBody = await chatbotsResponse.json();

    assert.equal(chatbotsResponse.status, 200);
    assert.equal(chatbotsBody.chatbots[0].botId, "dra-renata-reis");

    await app.request("/api/public/chatbots/dra-renata-reis/leads", {
      method: "POST",
      body: JSON.stringify({
        clientId: "clinica-renata",
        name: "Filtro Bot",
        intent: "severe_symptoms",
        source: {},
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const matchingResponse = await app.request("/api/leads?botId=dra-renata-reis");
    const matchingBody = await matchingResponse.json();
    const emptyResponse = await app.request("/api/leads?botId=outro-bot");
    const emptyBody = await emptyResponse.json();

    assert.equal(matchingBody.leads.length, 1);
    assert.equal(emptyBody.leads.length, 0);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("passes created leads to tracking service with request context", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));
  const tracked: unknown[] = [];
  const trackingService: TrackingService = {
    async trackLeadCreated(lead, chatbot, context) {
      tracked.push({ lead, chatbot, context });
      return [{ provider: "meta", status: "sent" }];
    },
  };

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService,
    });

    const response = await app.request("/api/public/chatbots/dra-renata-reis/leads", {
      method: "POST",
      body: JSON.stringify({
        clientId: "clinica-renata",
        name: "Tracking Context",
        intent: "severe_symptoms",
        source: {
          pageUrl: "https://cliente.example/urgente",
        },
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "User-Agent": "Test browser",
        "X-Forwarded-For": "203.0.113.10, 10.0.0.1",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.tracking[0].status, "sent");
    assert.equal(tracked.length, 1);
    assert.equal((tracked[0] as { context: { ipAddress: string } }).context.ipAddress, "203.0.113.10");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("tracks access and only exposes a session as a lead after name capture", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-sessions-"));
  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });
    const openedResponse = await app.request(
      "/api/public/chatbots/dra-renata-reis/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "clinica-renata",
          source: { pageUrl: "https://cliente.example/cardio" },
        }),
      },
    );
    const opened = await openedResponse.json();
    assert.equal(openedResponse.status, 201);

    const beforeName = await (await app.request("/api/leads")).json();
    assert.equal(beforeName.accesses.length, 1);
    assert.equal(beforeName.leads.length, 0);

    await app.request(
      `/api/public/chatbots/dra-renata-reis/sessions/${opened.session.id}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "name_captured",
          stepId: "name",
          name: "Guilherme",
        }),
      },
    );
    const afterName = await (await app.request("/api/leads")).json();
    assert.equal(afterName.leads.length, 1);
    assert.equal(afterName.leads[0].name, "Guilherme");
    assert.equal(afterName.leads[0].status, "new");
    assert.equal(afterName.leads[0].source.pageUrl, "https://cliente.example/cardio");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("links a completed lead to its session and updates automatic statuses", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-funnel-"));
  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
      conversionWebhookSecret: "test-secret",
    });
    const opened = await (
      await app.request("/api/public/chatbots/dra-renata-reis/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "clinica-renata", source: {} }),
      })
    ).json();
    const eventUrl = `/api/public/chatbots/dra-renata-reis/sessions/${opened.session.id}/events`;
    await app.request(eventUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "name_captured", name: "Paciente Real", stepId: "name" }),
    });
    await app.request(eventUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "intent_selected",
        intent: "schedule_exam",
        label: "Agendar exame",
        stepId: "intent",
      }),
    });

    const leadResponse = await app.request(
      "/api/public/chatbots/dra-renata-reis/leads",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: opened.session.id,
          clientId: "clinica-renata",
          name: "Paciente Real",
          intent: "schedule_exam",
          selectedExams: ["Ecocardiograma fetal"],
          medicalRequestStatus: "Sim",
          source: {},
        }),
      },
    );
    const created = await leadResponse.json();
    assert.equal(leadResponse.status, 201);

    const listed = await (await app.request("/api/leads")).json();
    assert.equal(listed.leads.length, 1);
    assert.equal(listed.leads[0].status, "appointment_requested");
    assert.deepEqual(listed.leads[0].selectedExams, ["Ecocardiograma fetal"]);
    assert.equal(listed.leads[0].events.some((event: { type: string }) => event.type === "lead_created"), true);

    const denied = await app.request(
      `/api/integrations/leads/${created.lead.id}/converted`,
      { method: "POST" },
    );
    assert.equal(denied.status, 401);
    const converted = await app.request(
      `/api/integrations/leads/${created.lead.id}/converted`,
      {
        method: "POST",
        headers: { Authorization: "Bearer test-secret" },
      },
    );
    assert.equal(converted.status, 200);
    const afterConversion = await (await app.request("/api/leads")).json();
    assert.equal(afterConversion.leads[0].status, "converted");
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("creates a chatbot with private integration credentials", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-chatbots-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });

    const response = await app.request("/api/chatbots", {
      method: "POST",
      body: JSON.stringify({
        botId: "clinica-teste",
        name: "Clínica Teste",
        clientId: "cliente-teste",
        clientName: "Cliente Teste",
        description: "Bot de captação de leads.",
        whatsappPhone: "5587999999999",
        status: "active",
        flowKey: "consultation_scheduling",
        buttonTexts: ["Agende agora"],
        examOptions: ["Exame A"],
        medicalRequestOptions: ["Sim", "Não"],
        consultationNeeds: ["Check-up"],
        consultationDecisions: ["Quero agendar uma consulta"],
        tracking: {
          meta: {
            pixelId: "pixel-123",
            accessToken: "secret-token",
          },
          googleAnalytics: {
            measurementId: "G-TEST",
            apiSecret: "ga-secret",
          },
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.chatbot.botId, "clinica-teste");
    assert.equal(body.chatbot.flowKey, "consultation_scheduling");
    assert.equal(body.chatbot.conversationFlow.intents.length, 1);
    assert.equal(body.chatbot.integrationStatus.metaConfigured, true);
    assert.equal(body.chatbot.integrationStatus.googleAnalyticsConfigured, true);
    assert.equal(JSON.stringify(body).includes("secret-token"), false);
    assert.equal(JSON.stringify(body).includes("ga-secret"), false);

    const publicResponse = await app.request(
      "/api/public/chatbots/clinica-teste/config",
    );
    const publicBody = await publicResponse.json();

    assert.equal(publicResponse.status, 200);
    assert.equal(publicBody.chatbot.name, "Clínica Teste");
    assert.equal(publicBody.chatbot.conversationFlow.key, "consultation_scheduling");
    assert.equal(JSON.stringify(publicBody).includes("secret-token"), false);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("uses a created chatbot to accept leads", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-chatbots-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });

    await app.request("/api/chatbots", {
      method: "POST",
      body: JSON.stringify({
        botId: "bot-dinamico",
        name: "Bot Dinâmico",
        clientId: "cliente-dinamico",
        clientName: "Cliente Dinâmico",
        status: "active",
        flowKey: "exam_scheduling",
        whatsappPhone: "",
        buttonTexts: ["Olá"],
        examOptions: ["Exame Dinâmico"],
        medicalRequestOptions: ["Sim", "Não"],
        consultationNeeds: ["Check-up"],
        consultationDecisions: ["Quero agendar uma consulta"],
        tracking: {},
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const response = await app.request("/api/public/chatbots/bot-dinamico/leads", {
      method: "POST",
      body: JSON.stringify({
        clientId: "cliente-dinamico",
        name: "Lead Dinâmico",
        intent: "schedule_exam",
        selectedExams: ["Exame Dinâmico"],
        medicalRequestStatus: "Sim",
        source: {},
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.lead.botId, "bot-dinamico");
    assert.match(body.whatsappMessage, /Exame Dinâmico/);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});

test("rejects leads for intents disabled by the chatbot flow", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-chatbots-"));

  try {
    const app = createApp({
      chatbotRepository: new FileChatbotRepository(path.join(tempDir, "chatbots.json")),
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
      trackingService: noOpTrackingService,
    });

    await app.request("/api/chatbots", {
      method: "POST",
      body: JSON.stringify({
        botId: "bot-consulta",
        name: "Bot Consulta",
        clientId: "cliente-consulta",
        clientName: "Cliente Consulta",
        status: "active",
        flowKey: "consultation_scheduling",
        whatsappPhone: "",
        buttonTexts: ["Olá"],
        examOptions: ["Exame Dinâmico"],
        medicalRequestOptions: ["Sim", "Não"],
        consultationNeeds: ["Check-up"],
        consultationDecisions: ["Quero agendar uma consulta"],
        tracking: {},
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const response = await app.request("/api/public/chatbots/bot-consulta/leads", {
      method: "POST",
      body: JSON.stringify({
        clientId: "cliente-consulta",
        name: "Lead Fora do Fluxo",
        intent: "schedule_exam",
        selectedExams: ["Exame Dinâmico"],
        medicalRequestStatus: "Sim",
        source: {},
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.issues.includes("intent is not enabled for this chatbot flow"));
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
