import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "./app.js";
import { FileLeadRepository } from "./leads/file-lead-repository.js";

test("creates and lists an exam lead", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
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
          referrer: "https://google.com",
          parentOrigin: "https://cliente.example",
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    assert.equal(createResponse.status, 201);

    const created = await createResponse.json();
    assert.equal(created.lead.name, "Teste");
    assert.equal(created.lead.intent, "schedule_exam");
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
  const app = createApp();
  const response = await app.request("/api/public/chatbots/dra-renata-reis/leads", {
    method: "POST",
    body: JSON.stringify({ intent: "schedule_exam" }),
    headers: new Headers({ "Content-Type": "application/json" }),
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.ok(body.issues.includes("name is required"));
  assert.ok(body.issues.includes("clientId is required"));
});

test("allows localhost dashboard ports during development", async () => {
  const app = createApp();
  const response = await app.request("/api/leads", {
    headers: new Headers({ Origin: "http://localhost:3002" }),
  });

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "http://localhost:3002",
  );
});

test("lists configured chatbots and filters leads by bot", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "imagin-leads-"));

  try {
    const app = createApp({
      leadRepository: new FileLeadRepository(path.join(tempDir, "leads.json")),
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
