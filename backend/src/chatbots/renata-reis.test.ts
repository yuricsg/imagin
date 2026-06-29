import assert from "node:assert/strict";
import test from "node:test";
import {
  formatWhatsAppMessage,
} from "./renata-reis.js";
import { getPublicChatbotConfig, listChatbots } from "./catalog.js";

test("formats exam WhatsApp message with selected exams", () => {
  const message = formatWhatsAppMessage({
    botId: "dra-renata-reis",
    clientId: "clinica-renata",
    name: "Teste",
    intent: "schedule_exam",
    selectedExams: [
      "Parecer cardiológico - pré operatório",
      "Ecocardiograma fetal",
      "Polissonografia tipo 3",
    ],
    medicalRequestStatus: "Tenho dúvidas",
    source: {},
  });

  assert.equal(
    message,
    "Oi, meu nome é Teste. Ainda tenho dúvidas: Parecer cardiológico - pré operatório, Ecocardiograma fetal, Polissonografia tipo 3. Possuo solicitação médica: Tenho dúvidas. Vim através do assistente de leads do site.",
  );
});

test("formats cardiology consultation WhatsApp message", () => {
  const message = formatWhatsAppMessage({
    botId: "dra-renata-reis",
    clientId: "clinica-renata",
    name: "teste2",
    intent: "schedule_consultation",
    consultationNeed: "Check-up",
    consultationDecision: "Quero agendar uma consulta",
    source: {},
  });

  assert.equal(
    message,
    "Oi, meu nome é teste2. Quero agendar uma consulta. Minha principal necessidade é: Check-up. Vim através do assistente de leads do site.",
  );
});

test("exposes the configured Renata Reis chatbot", () => {
  const chatbot = getPublicChatbotConfig("dra-renata-reis");

  assert.equal(chatbot?.botId, "dra-renata-reis");
  assert.equal(chatbot?.clientId, "clinica-renata");
  assert.ok(chatbot?.examOptions.includes("Ecocardiograma fetal"));
  assert.ok(chatbot?.buttonTexts.includes("Consultas e exames em um só lugar! Agende agora!"));
});

test("lists chatbots for the dashboard catalog", () => {
  const chatbots = listChatbots();

  assert.equal(chatbots.length, 1);
  assert.equal(chatbots[0].botId, "dra-renata-reis");
  assert.equal(chatbots[0].status, "active");
});
