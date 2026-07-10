import { describe, expect, it } from "vitest";
import {
  buildWhatsAppFromInput,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  DEFAULT_WHATSAPP_ROUTING_QUESTION,
  fillWhatsAppTemplate,
  isValidWhatsAppPhone,
  needsWhatsAppRouting,
  normalizeWhatsAppDestinations,
  normalizeWhatsAppPhone,
  listWhatsAppVariables,
  previewWhatsAppMessage,
  resolveWhatsAppDestination,
  resolveWhatsAppMessage,
  whatsAppUrl,
} from "./whatsapp";

describe("whatsapp", () => {
  it("normalizes phone to digits only", () => {
    expect(normalizeWhatsAppPhone("+55 (11) 99999-0000")).toBe("5511999990000");
  });

  it("validates phone length", () => {
    expect(isValidWhatsAppPhone("+55 11 99999-0000")).toBe(true);
    expect(isValidWhatsAppPhone("123")).toBe(false);
  });

  it("fills template variables", () => {
    const result = fillWhatsAppTemplate("Olá {nome}, tel {telefone}", {
      nome: "Ana",
      telefone: "11999990000",
    });
    expect(result).toBe("Olá Ana, tel 11999990000");
  });

  it("builds disabled config without phone", () => {
    expect(
      buildWhatsAppFromInput({
        whatsappEnabled: false,
        whatsappDestinations: [
          { id: "a", label: "", phoneNumber: "+55 11 99999-0000" },
        ],
        whatsappRoutingQuestion: "",
        whatsappMessageTemplate: "Oi {nome}",
      }),
    ).toEqual({
      enabled: false,
      phoneNumber: "",
      destinations: [],
      routingQuestion: DEFAULT_WHATSAPP_ROUTING_QUESTION,
      messageTemplate: "Oi {nome}",
    });
  });

  it("builds enabled config with normalized phone", () => {
    expect(
      buildWhatsAppFromInput({
        whatsappEnabled: true,
        whatsappDestinations: [
          { id: "a", label: "", phoneNumber: "+55 11 98888-7777" },
        ],
        whatsappRoutingQuestion: DEFAULT_WHATSAPP_ROUTING_QUESTION,
        whatsappMessageTemplate: "",
      }),
    ).toEqual({
      enabled: true,
      phoneNumber: "5511988887777",
      destinations: [{ id: "a", label: "", phoneNumber: "5511988887777" }],
      routingQuestion: DEFAULT_WHATSAPP_ROUTING_QUESTION,
      messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    });
  });

  it("keeps every destination and mirrors the first one as phoneNumber", () => {
    const config = buildWhatsAppFromInput({
      whatsappEnabled: true,
      whatsappDestinations: [
        { id: "sp", label: " Consultório SP ", phoneNumber: "+55 11 98888-7777" },
        { id: "rj", label: "Consultório RJ", phoneNumber: "+55 21 97777-6666" },
        { id: "blank", label: "Vazio", phoneNumber: "  " },
      ],
      whatsappRoutingQuestion: "  Qual unidade?  ",
      whatsappMessageTemplate: "Oi",
    });

    expect(config.destinations).toEqual([
      { id: "sp", label: "Consultório SP", phoneNumber: "5511988887777" },
      { id: "rj", label: "Consultório RJ", phoneNumber: "5521977776666" },
    ]);
    expect(config.phoneNumber).toBe("5511988887777");
    expect(config.routingQuestion).toBe("Qual unidade?");
  });

  it("migrates a legacy single phoneNumber into one destination", () => {
    const destinations = normalizeWhatsAppDestinations(
      undefined,
      "+55 11 98888-7777",
    );
    expect(destinations).toHaveLength(1);
    expect(destinations[0].phoneNumber).toBe("5511988887777");
    expect(destinations[0].label).toBe("");
  });

  it("routes only when there is more than one destination", () => {
    const one = [{ id: "a", label: "SP", phoneNumber: "5511988887777" }];
    const two = [...one, { id: "b", label: "RJ", phoneNumber: "5521977776666" }];

    expect(needsWhatsAppRouting({ enabled: true, destinations: one })).toBe(false);
    expect(needsWhatsAppRouting({ enabled: true, destinations: two })).toBe(true);
    expect(needsWhatsAppRouting({ enabled: false, destinations: two })).toBe(false);
  });

  it("resolves the chosen destination and falls back to the first", () => {
    const config = {
      phoneNumber: "5511988887777",
      destinations: [
        { id: "sp", label: "SP", phoneNumber: "5511988887777" },
        { id: "rj", label: "RJ", phoneNumber: "5521977776666" },
      ],
    };

    expect(resolveWhatsAppDestination(config, "rj")?.phoneNumber).toBe(
      "5521977776666",
    );
    expect(resolveWhatsAppDestination(config, "unknown")?.id).toBe("sp");
    expect(resolveWhatsAppDestination(config)?.id).toBe("sp");
    expect(
      resolveWhatsAppDestination({ phoneNumber: "", destinations: [] }),
    ).toBeNull();
  });

  it("fills the {unidade} placeholder with the chosen office", () => {
    expect(
      resolveWhatsAppMessage("Unidade: {unidade}", "Bot", {
        unidade: "Consultório RJ",
      }),
    ).toBe("Unidade: Consultório RJ");
    expect(resolveWhatsAppMessage("Unidade: {unidade}", "Bot")).toBe(
      "Unidade: ",
    );
  });

  it("builds wa.me url", () => {
    const url = whatsAppUrl("5511999990000", "Olá!");
    expect(url).toBe("https://wa.me/5511999990000?text=Ol%C3%A1!");
  });

  it("previews message with sample values and bot name", () => {
    expect(previewWhatsAppMessage("Vim pelo {bot}", "Dra. Renata")).toBe(
      "Vim pelo Dra. Renata",
    );
    expect(previewWhatsAppMessage("Nome: {nome}", "Bot")).toContain(
      "Maria Silva",
    );
  });

  it("resolves bot name in resolveWhatsAppMessage", () => {
    expect(
      resolveWhatsAppMessage(
        "Olá! Vim pelo {bot}",
        "dfgss",
        { nome: "Ana" },
      ),
    ).toBe("Olá! Vim pelo dfgss");
  });

  it("lists custom Salvar como categories as WhatsApp variables", () => {
    const vars = listWhatsAppVariables({
      convenio: "Convênio",
      horario: "Horário preferido",
    });
    expect(vars.some((v) => v.token === "convenio" && v.key === "{convenio}")).toBe(
      true,
    );
    expect(vars.some((v) => v.token === "horario")).toBe(true);
    expect(vars.some((v) => v.token === "nome")).toBe(true);
  });

  it("fills custom category placeholders in preview and resolve", () => {
    expect(
      previewWhatsAppMessage(
        "Plano: {convenio}",
        "Bot",
        { convenio: "Convênio" },
      ),
    ).toContain("Convênio");
    expect(
      resolveWhatsAppMessage(
        "Plano: {convenio}",
        "Bot",
        { convenio: "Unimed" },
        { convenio: "Convênio" },
      ),
    ).toBe("Plano: Unimed");
  });
});
