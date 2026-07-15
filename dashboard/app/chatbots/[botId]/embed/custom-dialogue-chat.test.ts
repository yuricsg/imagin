import { describe, expect, it } from "vitest";
import type { Chatbot } from "@/lib/chatbots/types";
import { buildPreviewLeadResponse } from "./custom-dialogue-chat";

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
});
