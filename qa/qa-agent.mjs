#!/usr/bin/env node

const options = readOptions(process.argv.slice(2));
const dashboardUrl = normalizeUrl(
  options["dashboard-url"] ?? process.env.DASHBOARD_URL ?? "http://localhost:3002",
);
const apiUrl = normalizeUrl(
  options["api-url"] ?? process.env.API_URL ?? "http://localhost:4000",
);
const botId = options["bot-id"] ?? process.env.BOT_ID ?? "dra-renata-reis";
const allowWrites = process.env.QA_ALLOW_WRITES === "true";
const results = [];

await check("API health responds 200", async () => {
  const response = await request(`${apiUrl}/health`);
  assert(response.status === 200, `Expected 200, got ${response.status}`);
});

await check("Dashboard serves useful HTML", async () => {
  const response = await request(dashboardUrl);
  const text = await response.text();
  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(text.includes("__next") || text.includes("Captação"), "Dashboard HTML does not look like the app");
});

await check("Embed route serves useful HTML", async () => {
  const response = await request(`${dashboardUrl}/chatbots/${encodeURIComponent(botId)}/embed`);
  const text = await response.text();
  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(text.includes("__next") || text.includes("Assistente"), "Embed HTML does not look like the app");
});

let publicConfig;
await check("Public chatbot config is valid and secret-safe", async () => {
  const response = await request(`${apiUrl}/api/public/chatbots/${encodeURIComponent(botId)}/config`);
  publicConfig = await response.json();
  const raw = JSON.stringify(publicConfig).toLowerCase();

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(publicConfig.chatbot?.botId === botId, "Config botId mismatch");
  assert(publicConfig.chatbot?.flowKey, "Config is missing flowKey");
  assert(publicConfig.chatbot?.conversationFlow?.key, "Config is missing conversationFlow");
  assert(publicConfig.chatbot?.integrationStatus, "Config is missing integrationStatus");
  assert(!raw.includes("accesstoken"), "Public config leaked access token field");
  assert(!raw.includes("apisecret"), "Public config leaked API secret field");
});

await check("Dashboard chatbot list is available", async () => {
  const response = await request(`${apiUrl}/api/chatbots`);
  const body = await response.json();

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(Array.isArray(body.chatbots), "chatbots must be an array");
  assert(body.chatbots.some((chatbot) => chatbot.botId === botId), `Missing bot ${botId}`);
});

await check("Lead API exposes real data and access events without mock fallback", async () => {
  const response = await request(`${apiUrl}/api/leads`);
  const body = await response.json();
  const knownMockNames = new Set([
    "Camila Andrade",
    "Rafael Monteiro",
    "Beatriz Lopes",
    "Thiago Ferreira",
    "Larissa Pires",
    "Juliana Castro",
    "Marcos Vinícius",
    "Patrícia Gomes",
  ]);

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(Array.isArray(body.leads), "leads must be an array");
  assert(Array.isArray(body.accesses), "accesses must be an array");
  assert(
    !body.leads.some((lead) => knownMockNames.has(lead.name)),
    "Lead API contains a known dashboard mock",
  );
});

if (allowWrites) {
  const qaBotId = `qa-${Date.now()}`;
  let qaSessionId;

  await check("Can create chatbot with selected flow", async () => {
    const response = await request(`${apiUrl}/api/chatbots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: qaBotId,
        name: "QA Bot",
        clientId: "qa-client",
        clientName: "QA Client",
        status: "active",
        flowKey: "consultation_scheduling",
        description: "Temporary QA chatbot",
        whatsappPhone: "",
        buttonTexts: ["QA start"],
        examOptions: ["QA Exam"],
        medicalRequestOptions: ["Sim", "Não"],
        consultationNeeds: ["Check-up"],
        consultationDecisions: ["Quero agendar uma consulta"],
        tracking: {
          meta: { pixelId: "", accessToken: "", testEventCode: "" },
          googleAnalytics: { measurementId: "", apiSecret: "" },
        },
      }),
    });
    const body = await response.json();

    assert(response.status === 201, `Expected 201, got ${response.status}: ${JSON.stringify(body)}`);
    assert(body.chatbot.flowKey === "consultation_scheduling", "Created bot flow mismatch");
  });

  await check("Rejects lead intent disabled by selected flow", async () => {
    const response = await request(`${apiUrl}/api/public/chatbots/${qaBotId}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "qa-client",
        name: "QA Lead",
        intent: "schedule_exam",
        selectedExams: ["QA Exam"],
        medicalRequestStatus: "Sim",
        source: { pageUrl: "https://qa.example/?utm_source=qa" },
      }),
    });
    const body = await response.json();

    assert(response.status === 400, `Expected 400, got ${response.status}`);
    assert(
      body.issues?.includes("intent is not enabled for this chatbot flow"),
      "Missing disabled intent validation issue",
    );
  });

  await check("Opening a chat creates an access but not an anonymous lead", async () => {
    const response = await request(`${apiUrl}/api/public/chatbots/${qaBotId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "qa-client",
        source: { pageUrl: "https://qa.example/session" },
      }),
    });
    const body = await response.json();
    qaSessionId = body.session?.id;
    assert(response.status === 201, `Expected 201, got ${response.status}`);
    assert(qaSessionId, "Session id is missing");

    const listedResponse = await request(`${apiUrl}/api/leads?botId=${qaBotId}`);
    const listed = await listedResponse.json();
    assert(listed.accesses.length === 1, "Chat opening was not counted as an access");
    assert(listed.leads.length === 0, "Anonymous session leaked into the lead list");
  });

  await check("Name capture creates a real lead candidate with automatic status", async () => {
    const response = await request(
      `${apiUrl}/api/public/chatbots/${qaBotId}/sessions/${qaSessionId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "name_captured",
          stepId: "name",
          name: "QA Lead",
        }),
      },
    );
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    const listed = await (await request(`${apiUrl}/api/leads?botId=${qaBotId}`)).json();
    assert(listed.leads.length === 1, "Named session did not become a lead candidate");
    assert(listed.leads[0].status === "new", "Named session must start as new");
  });

  await check("Can create lead for selected flow", async () => {
    const response = await request(`${apiUrl}/api/public/chatbots/${qaBotId}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "qa-client",
        sessionId: qaSessionId,
        name: "QA Lead",
        intent: "schedule_consultation",
        consultationNeed: "Check-up",
        consultationDecision: "Quero agendar uma consulta",
        source: {
          pageUrl: "https://qa.example/?utm_source=qa&utm_medium=smoke",
          utm: { source: "qa", medium: "smoke", campaign: "qa-agent" },
          clickIds: { gclid: "qa-gclid" },
        },
      }),
    });
    const body = await response.json();

    assert(response.status === 201, `Expected 201, got ${response.status}: ${JSON.stringify(body)}`);
    assert(body.lead?.botId === qaBotId, "Lead botId mismatch");
    assert(body.lead?.source?.utm?.source === "qa", "Lead source attribution missing");
    const listed = await (await request(`${apiUrl}/api/leads?botId=${qaBotId}`)).json();
    assert(listed.leads.length === 1, "Session and completed lead were duplicated");
    assert(
      listed.leads[0].status === "appointment_requested",
      "Explicit scheduling decision did not update the automatic status",
    );
  });
} else {
  results.push({
    name: "Write-path checks",
    status: "skipped",
    detail: "Set QA_ALLOW_WRITES=true to create a temporary bot and lead.",
  });
}

printResults(results);

if (results.some((result) => result.status === "failed")) {
  process.exitCode = 1;
}

async function check(name, callback) {
  try {
    await callback();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({
      name,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function request(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readOptions(args) {
  return Object.fromEntries(
    args
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...valueParts] = arg.slice(2).split("=");
        return [key, valueParts.join("=")];
      }),
  );
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, "");
}

function printResults(entries) {
  for (const entry of entries) {
    const prefix =
      entry.status === "passed" ? "PASS" : entry.status === "skipped" ? "SKIP" : "FAIL";
    const detail = entry.detail ? ` - ${entry.detail}` : "";
    console.log(`${prefix} ${entry.name}${detail}`);
  }
}
