import { describe, expect, it } from "vitest";
import type { Chatbot } from "@/lib/chatbots/types";
import {
  extractLeadFieldsFromAnswers,
  type DialogueFlow,
} from "@/lib/chatbots/flows";
import { buildPreviewLeadResponse, resolveClosingLines } from "./custom-dialogue-chat";

/** Minimal bot exercising only what buildPreviewLeadResponse reads. */
function bot(whatsapp: Partial<Chatbot["whatsapp"]>): Chatbot {
  return {
    name: "Dra. Ana",
    flow: { dialogue: undefined },
    whatsapp: {
      enabled: true,
      phoneNumber: "5511999990000",
      destinations: [],
      routingQuestion: "",
      messageTemplate: "Olá {bot}, sou {nome}. Unidade: {unidade}",
      ...whatsapp,
    },
  } as unknown as Chatbot;
}

const fields = {
  name: "Maria",
  phone: "11988887777",
  email: "",
  message: "",
  custom: {},
};

describe("buildPreviewLeadResponse", () => {
  it("fills the template and links to the primary number", () => {
    const res = buildPreviewLeadResponse(bot({}), "Maria", fields, null);
    expect(res.whatsappMessage).toBe("Olá Dra. Ana, sou Maria. Unidade: ");
    expect(res.whatsappUrl).toBe(
      `https://wa.me/5511999990000?text=${encodeURIComponent(
        "Olá Dra. Ana, sou Maria. Unidade: ",
      )}`,
    );
  });

  it("routes to the chosen office and fills {unidade}", () => {
    const chosen = {
      id: "rj",
      label: "Consultório RJ",
      phoneNumber: "5521977776666",
    };
    const res = buildPreviewLeadResponse(bot({}), "Maria", fields, chosen);
    expect(res.whatsappMessage).toContain("Unidade: Consultório RJ");
    expect(res.whatsappUrl).toContain("https://wa.me/5521977776666?text=");
  });

  it("produces no message or link when WhatsApp is disabled", () => {
    const res = buildPreviewLeadResponse(
      bot({ enabled: false }),
      "Maria",
      fields,
      null,
    );
    expect(res.whatsappMessage).toBe("");
    expect(res.whatsappUrl).toBe("");
  });

  it("resolves option ids to labels in the handoff message (reported bug)", () => {
    // Dialogue and answers from the "Ana - Assistente virtual" report: choice
    // answers are stored as option ids and must render as labels.
    const dialogue: DialogueFlow = {
      version: 1,
      shape: "linear",
      greeting: "",
      startStepId: "step-nome",
      steps: [
        { id: "step-nome", question: "Como posso te chamar?", inputType: "text", saveAs: "name" },
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
      customSaveLabels: { exame: "Exame", solicitacao: "Solicitação" },
    };
    const sourceBot = {
      ...bot({
        messageTemplate:
          "Oi, meu nome é {nome}. Gostaria de {exame}. Possuo solicitação: {solicitacao}",
      }),
      flow: { dialogue },
    } as unknown as Chatbot;

    const extracted = extractLeadFieldsFromAnswers(dialogue, {
      "step-nome": "gard",
      "step-exames": ["opt-mrnnzskh-62", "opt-mrnnzpxc-61"],
      "step-solicitacao": "opt-mrno0ong-67",
    });
    const res = buildPreviewLeadResponse(sourceBot, extracted.name, extracted, null);

    expect(res.whatsappMessage).toBe(
      "Oi, meu nome é gard. Gostaria de Parecer cardiológico - pré operatório, Teste ergométrico. Possuo solicitação: Sim",
    );
    expect(res.whatsappMessage).not.toContain("opt-");
    expect(decodeURIComponent(res.whatsappUrl)).toContain("Teste ergométrico");
  });
});

describe("resolveClosingLines", () => {
  const formalBot = (whatsapp: Partial<Chatbot["whatsapp"]>): Chatbot =>
    ({ ...bot(whatsapp), flow: { tone: "formal" } }) as unknown as Chatbot;

  it("uses the custom closing message when WhatsApp is enabled", () => {
    const lines = resolveClosingLines(
      bot({ closingMessage: "  Manda a mensagem pra gente!  " }),
      null,
    );
    expect(lines).toEqual([
      "Prontinho! Já recebemos seus dados. 🙏",
      "Manda a mensagem pra gente!",
    ]);
  });

  it("falls back to the friendly default when there is no custom text", () => {
    expect(resolveClosingLines(bot({}), null)[1]).toBe(
      "Continue no WhatsApp para falar com nossa equipe.",
    );
  });

  it("falls back to the formal default and formal confirmation", () => {
    expect(resolveClosingLines(formalBot({}), null)).toEqual([
      "Obrigado. Suas informações foram registradas. 🙏",
      "Continue o atendimento pelo WhatsApp para confirmar os detalhes.",
    ]);
  });

  it("keeps the office-specific default when a destination was chosen", () => {
    const chosen = {
      id: "rj",
      label: "Consultório RJ",
      phoneNumber: "5521977776666",
    };
    expect(resolveClosingLines(bot({}), chosen)[1]).toBe(
      "Continue no WhatsApp para falar com a equipe do Consultório RJ.",
    );
    expect(resolveClosingLines(formalBot({}), chosen)[1]).toBe(
      "Continue o atendimento pelo WhatsApp do Consultório RJ para confirmar os detalhes.",
    );
  });

  it("lets the custom message win over the office variant", () => {
    const chosen = {
      id: "rj",
      label: "Consultório RJ",
      phoneNumber: "5521977776666",
    };
    expect(
      resolveClosingLines(bot({ closingMessage: "Te espero no WhatsApp!" }), chosen)[1],
    ).toBe("Te espero no WhatsApp!");
  });

  it("ignores the custom message when WhatsApp is disabled", () => {
    expect(
      resolveClosingLines(
        bot({ enabled: false, closingMessage: "Texto ignorado" }),
        null,
      )[1],
    ).toBe("Nossa equipe entrará em contato em breve para dar sequência.");
    expect(
      resolveClosingLines(
        formalBot({ enabled: false, closingMessage: "Texto ignorado" }),
        null,
      )[1],
    ).toBe("Nossa equipe entrará em contato em breve.");
  });
});
