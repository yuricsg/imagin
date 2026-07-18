import assert from "node:assert/strict";
import test from "node:test";
import {
  fillDashboardWhatsAppTemplate,
  formatStandardWhatsAppMessage,
} from "./standard-flow.js";
import type { LeadSubmission } from "../leads/types.js";

/**
 * Dialogue mirroring the "Ana - Assistente virtual" bot from the bug report:
 * choice answers arrive as option ids and must render as their labels.
 */
const dashboardConfig = {
  name: "Ana - Assistente virtual",
  whatsapp: {
    enabled: true,
    phoneNumber: "5511999990000",
    messageTemplate:
      "Oi, meu nome é {nome}. Gostaria de {mensagem} {necessidade} {exame}. Possuo solicitação: {solicitacao} Vim através do assistente de leads do site.",
  },
  flow: {
    dialogue: {
      version: 1,
      shape: "linear",
      greeting: "",
      startStepId: "step-nome",
      steps: [
        { id: "step-nome", question: "Como posso te chamar?", inputType: "text", saveAs: "name" },
        {
          id: "step-intencao",
          question: "O que você deseja?",
          inputType: "single_choice",
          saveAs: "message",
          options: [
            { id: "opt-mrnnrt7c-49", label: "agendar exames" },
            { id: "opt-outra", label: "agendar consulta" },
          ],
        },
        {
          id: "step-necessidade",
          question: "Qual a sua necessidade?",
          inputType: "single_choice",
          saveAs: "necessidade",
          options: [
            { id: "opt-nec-1", label: "Check-up" },
            { id: "opt-nec-2", label: "Avaliação" },
          ],
        },
        {
          id: "step-exames",
          question: "Quais exames?",
          inputType: "multi_choice",
          saveAs: "exame",
          options: [
            { id: "opt-mrnnzskh-62", label: "Parecer cardiológico - pré operatório" },
            { id: "opt-mrnnzpxc-61", label: "Teste ergométrico" },
          ],
        },
        {
          id: "step-solicitacao",
          question: "Possui solicitação médica?",
          inputType: "single_choice",
          saveAs: "solicitacao",
          options: [
            { id: "opt-mrno0ong-67", label: "Sim" },
            { id: "opt-nao", label: "Não" },
          ],
        },
      ],
      customSaveLabels: {
        necessidade: "Necessidade",
        exame: "Exame",
        solicitacao: "Solicitação",
      },
    },
  },
};

/** Answers exactly as the widget sent them in the reported bug (option ids). */
const reportedAnswers = {
  "step-nome": "gard",
  "step-intencao": "opt-mrnnrt7c-49",
  "step-necessidade": "opt-nec-1",
  "step-exames": ["opt-mrnnzskh-62", "opt-mrnnzpxc-61"],
  "step-solicitacao": "opt-mrno0ong-67",
};

function lead(overrides: Partial<LeadSubmission> = {}): LeadSubmission {
  return {
    botId: "ana-assistente-virtual",
    clientId: "clinica-ana",
    name: "gard",
    intent: "schedule_exam",
    flowMode: "custom_dialogue",
    source: {},
    ...overrides,
  };
}

test("resolves option ids to labels in the custom dialogue template", () => {
  // Exactly what the widget sent in the reported bug: ids in both the
  // pre-extracted fields and the raw step answers.
  const message = formatStandardWhatsAppMessage(
    lead({
      message: "opt-mrnnrt7c-49",
      customFields: {
        necessidade: "opt-nec-1",
        exame: "opt-mrnnzskh-62, opt-mrnnzpxc-61",
        solicitacao: "opt-mrno0ong-67",
      },
      answers: reportedAnswers,
    }),
    dashboardConfig,
  );

  assert.equal(
    message,
    "Oi, meu nome é gard. Gostaria de agendar exames Check-up Parecer cardiológico - pré operatório, Teste ergométrico. Possuo solicitação: Sim Vim através do assistente de leads do site.",
  );
  assert.ok(!message.includes("opt-"));
});

test("keeps already-human values when the widget sends labels", () => {
  const message = formatStandardWhatsAppMessage(
    lead({
      message: "agendar exames",
      customFields: {
        necessidade: "Check-up",
        exame: "Parecer cardiológico - pré operatório, Teste ergométrico",
        solicitacao: "Sim",
      },
      answers: reportedAnswers,
    }),
    dashboardConfig,
  );

  assert.ok(
    message.includes(
      "Gostaria de agendar exames Check-up Parecer cardiológico - pré operatório, Teste ergométrico.",
    ),
  );
  assert.ok(message.includes("Possuo solicitação: Sim"));
  assert.ok(!message.includes("opt-"));
});

test("resolves {unidade} from customFields and {telefone}/{email} from the lead", () => {
  const message = formatStandardWhatsAppMessage(
    lead({
      phone: "5511988887777",
      email: "gard@example.com",
      customFields: { unidade: "Consultório de SP" },
      answers: reportedAnswers,
    }),
    {
      ...dashboardConfig,
      whatsapp: {
        messageTemplate:
          "{nome} · {telefone} · {email} · {unidade} · {mensagem} · {bot}",
      },
    },
  );

  assert.equal(
    message,
    "gard · 5511988887777 · gard@example.com · Consultório de SP · agendar exames · Ana - Assistente virtual",
  );
});

test("falls back to the raw value for ids unknown to the dialogue", () => {
  const message = formatStandardWhatsAppMessage(
    lead({
      answers: {
        ...reportedAnswers,
        "step-intencao": "opt-removida",
      },
    }),
    dashboardConfig,
  );

  // Unknown option id: shown as-is, never as an empty string.
  assert.ok(message.includes("opt-removida"));
  assert.ok(message.includes("Possuo solicitação: Sim"));
});

test("resolves labels in the no-template fallback message too", () => {
  const configSemTemplate = {
    name: dashboardConfig.name,
    flow: dashboardConfig.flow,
  };
  const message = formatStandardWhatsAppMessage(
    lead({ answers: reportedAnswers }),
    configSemTemplate,
  );

  assert.ok(
    message.includes("Parecer cardiológico - pré operatório, Teste ergométrico"),
  );
  assert.ok(message.includes("Sim"));
  assert.ok(!message.includes("opt-"));
});

test("keeps legacy behavior when the bot has no dialogue config", () => {
  const message = formatStandardWhatsAppMessage(
    lead({
      customFields: { convenio: "Unimed" },
      answers: { step1: "valor livre" },
    }),
    { name: "Bot", whatsapp: { messageTemplate: "Nome: {nome} · {convenio}" } },
  );

  assert.equal(message, "Nome: gard · Unimed");
});

test("fillDashboardWhatsAppTemplate leaves unknown tokens untouched", () => {
  assert.equal(
    fillDashboardWhatsAppTemplate("Oi {nome} — {desconhecido}", { nome: "Ana" }),
    "Oi Ana — {desconhecido}",
  );
});
