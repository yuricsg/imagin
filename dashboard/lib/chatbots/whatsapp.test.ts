import { describe, expect, it } from "vitest";
import {
  buildWhatsAppFromInput,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  fillWhatsAppTemplate,
  isValidWhatsAppPhone,
  normalizeWhatsAppPhone,
  listWhatsAppVariables,
  previewWhatsAppMessage,
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
        whatsappPhoneNumber: "+55 11 99999-0000",
        whatsappMessageTemplate: "Oi {nome}",
      }),
    ).toEqual({
      enabled: false,
      phoneNumber: "",
      messageTemplate: "Oi {nome}",
    });
  });

  it("builds enabled config with normalized phone", () => {
    expect(
      buildWhatsAppFromInput({
        whatsappEnabled: true,
        whatsappPhoneNumber: "+55 11 98888-7777",
        whatsappMessageTemplate: "",
      }),
    ).toEqual({
      enabled: true,
      phoneNumber: "5511988887777",
      messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    });
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
