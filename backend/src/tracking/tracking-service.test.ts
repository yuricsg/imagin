import assert from "node:assert/strict";
import test from "node:test";
import { renataReisChatbot } from "../chatbots/renata-reis.js";
import type { LeadRecord } from "../leads/types.js";
import {
  buildGa4LeadPayload,
  buildMetaLeadPayload,
  createTrackingService,
} from "./tracking-service.js";

const lead: LeadRecord = {
  id: "lead-123",
  botId: "dra-renata-reis",
  clientId: "clinica-renata",
  name: "Lead Tracking",
  intent: "schedule_consultation",
  consultationNeed: "Check-up",
  consultationDecision: "Quero agendar uma consulta",
  source: {
    pageUrl: "https://cliente.example/agendar?utm_source=google",
    landingPageUrl: "https://cliente.example/agendar?utm_source=google",
    referrer: "https://google.com",
    parentOrigin: "https://cliente.example",
    utm: {
      source: "google",
      medium: "cpc",
      campaign: "cardio",
    },
    clickIds: {
      gclid: "test-gclid",
      fbclid: "test-fbclid",
    },
    cookies: {
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.test-fbclid",
      gaClientId: "123.456",
    },
  },
  whatsappMessage: "Oi",
  whatsappUrl: "https://wa.me/?text=Oi",
  status: "new",
  createdAt: "2026-06-30T12:00:00.000Z",
  updatedAt: "2026-06-30T12:00:00.000Z",
};

test("builds Meta CAPI payload without exposing lead name", () => {
  const payload = buildMetaLeadPayload({
    chatbot: renataReisChatbot,
    context: {
      ipAddress: "127.0.0.1",
      userAgent: "Test browser",
    },
    lead,
    now: () => new Date("2026-06-30T12:00:00.000Z"),
  });

  assert.equal(payload.data[0].event_name, "Lead");
  assert.equal(payload.data[0].event_id, "lead-123");
  assert.equal(payload.data[0].user_data.fbc, "fb.1.123.test-fbclid");
  assert.equal(payload.data[0].custom_data.utm_source, "google");
  assert.equal(JSON.stringify(payload).includes("Lead Tracking"), false);
});

test("builds GA4 generate_lead payload with campaign fields", () => {
  const payload = buildGa4LeadPayload({ chatbot: renataReisChatbot, lead });

  assert.equal(payload.client_id, "123.456");
  assert.equal(payload.events[0].name, "generate_lead");
  assert.equal(payload.events[0].params.campaign_source, "google");
  assert.equal(payload.events[0].params.gclid, "test-gclid");
});

test("tracking service skips providers without credentials", async () => {
  const trackingService = createTrackingService({
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
  });

  const results = await trackingService.trackLeadCreated(lead, renataReisChatbot, {});

  assert.deepEqual(
    results.map((result) => result.status),
    ["skipped", "skipped"],
  );
});

test("tracking service dispatches configured Meta and GA4 calls", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const chatbot = {
    ...renataReisChatbot,
    tracking: {
      meta: {
        pixelId: "pixel-123",
        accessToken: "meta-token",
      },
      googleAnalytics: {
        measurementId: "G-TEST",
        apiSecret: "ga-secret",
      },
    },
  };
  const trackingService = createTrackingService({
    fetchImpl: async (url, init) => {
      calls.push({
        url: url.toString(),
        body: JSON.parse(init?.body?.toString() ?? "{}"),
      });

      return new Response("{}", { status: 200 });
    },
    now: () => new Date("2026-06-30T12:00:00.000Z"),
  });

  const results = await trackingService.trackLeadCreated(lead, chatbot, {
    ipAddress: "127.0.0.1",
    userAgent: "Test browser",
  });

  assert.deepEqual(
    results.map((result) => result.status),
    ["sent", "sent"],
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /graph\.facebook\.com/);
  assert.match(calls[1].url, /google-analytics\.com\/mp\/collect/);
});
