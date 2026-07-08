import { describe, expect, it } from "vitest";
import {
  buildFlowPreview,
  defaultFlowForTemplate,
  resolveGreeting,
  suggestTemplateForSpecialty,
} from "./flows";

describe("suggestTemplateForSpecialty", () => {
  it("maps known keywords to templates", () => {
    expect(suggestTemplateForSpecialty("Agendamento de exames")).toBe(
      "exam-scheduling",
    );
    expect(
      suggestTemplateForSpecialty("Agendamento de consultas"),
    ).toBe("appointment");
  });

  it("falls back using keywords", () => {
    expect(suggestTemplateForSpecialty("Triagem de urgência")).toBe("triage");
    expect(suggestTemplateForSpecialty("Cardiologia")).toBe("patient-capture");
  });
});

describe("resolveGreeting", () => {
  it("interpolates template default when greeting is empty", () => {
    const flow = defaultFlowForTemplate("patient-capture");
    expect(
      resolveGreeting(flow, {
        botName: "Dra. Ana",
        clientName: "Clínica Ana",
      }),
    ).toContain("Dra. Ana");
    expect(
      resolveGreeting(flow, {
        botName: "Dra. Ana",
        clientName: "Clínica Ana",
      }),
    ).toContain("Clínica Ana");
  });

  it("uses custom greeting when provided", () => {
    const flow = {
      ...defaultFlowForTemplate("patient-capture"),
      greeting: "Bem-vindo à {clientName}!",
    };
    expect(
      resolveGreeting(flow, { botName: "Bot", clientName: "Clínica X" }),
    ).toBe("Bem-vindo à Clínica X!");
  });
});

describe("buildFlowPreview", () => {
  it("includes greeting, a prompt, collect fields and closing", () => {
    const flow = defaultFlowForTemplate("exam-scheduling");
    const preview = buildFlowPreview(flow, {
      botName: "Assistente",
      clientName: "Clínica",
    });

    expect(preview[0].role).toBe("bot");
    expect(preview.some((m) => m.text.includes("Assistente"))).toBe(true);
    expect(preview.filter((m) => m.role === "bot").length).toBeGreaterThan(2);
    expect(preview.at(-1)?.text).toMatch(/equipe/i);
  });
});
