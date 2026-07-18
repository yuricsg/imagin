import { describe, expect, it } from "vitest";
import {
  isNotInterestedDecision,
  resolveCompletionMessages,
  resolveFarewellMessages,
} from "./embedded-chatbot";

type Config = Parameters<typeof resolveCompletionMessages>[0];

/**
 * Minimal config exercising only what resolveCompletionMessages reads:
 * `dashboardConfig` (normalized client-side) with a tone and a whatsapp block.
 */
function configWith(
  tone: "friendly" | "formal",
  whatsapp: Record<string, unknown>,
): Config {
  return {
    dashboardConfig: {
      id: "bot-x",
      name: "Bot X",
      flow: { tone },
      whatsapp,
    },
  } as unknown as Config;
}

describe("resolveCompletionMessages", () => {
  it("uses the custom closing message with the friendly confirmation", () => {
    const messages = resolveCompletionMessages(
      configWith("friendly", {
        enabled: true,
        closingMessage: "Envie a mensagem para ser atendido(a).",
      }),
    );
    expect(messages).toEqual([
      "Prontinho! Já recebemos seus dados. 🙏",
      "Envie a mensagem para ser atendido(a).",
    ]);
  });

  it("uses the custom closing message with the formal confirmation", () => {
    const messages = resolveCompletionMessages(
      configWith("formal", {
        enabled: true,
        closingMessage: "Prossiga para o WhatsApp.",
      }),
    );
    expect(messages).toEqual([
      "Obrigado. Suas informações foram registradas. 🙏",
      "Prossiga para o WhatsApp.",
    ]);
  });

  it("falls back to the tone defaults when there is no custom text", () => {
    expect(
      resolveCompletionMessages(configWith("friendly", { enabled: true }))[1],
    ).toBe("Continue no WhatsApp para falar com nossa equipe e ver os horários.");
    expect(
      resolveCompletionMessages(configWith("formal", { enabled: true }))[1],
    ).toBe("Continue o atendimento pelo WhatsApp para confirmar os detalhes.");
  });

  it("ignores the custom message when WhatsApp is disabled", () => {
    expect(
      resolveCompletionMessages(
        configWith("friendly", {
          enabled: false,
          closingMessage: "Texto ignorado",
        }),
      )[1],
    ).toBe("Nossa equipe entrará em contato em breve para dar sequência.");
  });
});

describe("isNotInterestedDecision", () => {
  it("matches the same no-interest texts the funnel detects", () => {
    expect(isNotInterestedDecision("Não tenho interesse no momento")).toBe(true);
    expect(isNotInterestedDecision("sem interesse")).toBe(true);
    expect(isNotInterestedDecision("Não quero")).toBe(true);
    expect(isNotInterestedDecision("Agora não")).toBe(true);
  });

  it("does not flag scheduling or doubt answers", () => {
    expect(isNotInterestedDecision("Quero agendar uma consulta")).toBe(false);
    expect(isNotInterestedDecision("Tenho dúvidas")).toBe(false);
    expect(isNotInterestedDecision("Não")).toBe(false);
  });
});

describe("resolveFarewellMessages", () => {
  it("returns a single polite goodbye per tone", () => {
    expect(resolveFarewellMessages(configWith("friendly", {}))).toEqual([
      "Tudo bem! Se precisar, é só chamar por aqui. 😊",
    ]);
    expect(resolveFarewellMessages(configWith("formal", {}))).toEqual([
      "Agradecemos o contato. Se precisar, estamos à disposição por aqui.",
    ]);
  });
});
