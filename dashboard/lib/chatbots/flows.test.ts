import { describe, expect, it } from "vitest";
import {
  buildFlowPreview,
  defaultFlowForTemplate,
  extractLeadFieldsFromAnswers,
  applyToneToDialogue,
  resolveGreeting,
  resolveNextStepId,
  seedDialogueFromTemplate,
  suggestTemplateForSpecialty,
  validateDialogueFlow,
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

  it("uses dialogue steps when present", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      shape: "linear",
    });
    const flow = {
      ...defaultFlowForTemplate("patient-capture"),
      dialogue,
    };
    const preview = buildFlowPreview(flow, {
      botName: "Bot",
      clientName: "Clínica",
    });
    expect(preview.some((m) => m.text === dialogue.steps[0].question)).toBe(
      true,
    );
  });
});

describe("seedDialogueFromTemplate / navigation", () => {
  it("seeds a linear dialogue with choice and contact steps", () => {
    const dialogue = seedDialogueFromTemplate("exam-scheduling", {
      shape: "linear",
      services: ["ECG", "Raio-X"],
      collectFields: ["name", "phone"],
    });
    expect(dialogue.version).toBe(1);
    expect(dialogue.shape).toBe("linear");
    expect(dialogue.steps.length).toBeGreaterThanOrEqual(3);
    expect(dialogue.steps[0].inputType).toBe("single_choice");
    expect(dialogue.steps[0].options?.map((o) => o.label)).toEqual([
      "ECG",
      "Raio-X",
    ]);
    expect(validateDialogueFlow(dialogue)).toEqual([]);
  });

  it("resolves next step linearly", () => {
    const dialogue = seedDialogueFromTemplate("appointment", {
      shape: "linear",
      collectFields: ["name"],
      insuranceMode: "particular",
    });
    const first = dialogue.steps[0];
    const next = resolveNextStepId(dialogue, first.id, first.options?.[0]?.id);
    expect(next).toBe(dialogue.steps[1]?.id);
  });

  it("resolves branching nextStepId or end", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      shape: "branching",
      insuranceMode: "particular",
      collectFields: ["name"],
    });
    const first = dialogue.steps[0];
    const option = first.options![0];
    option.nextStepId = dialogue.steps[1].id;
    expect(resolveNextStepId(dialogue, first.id, option.id)).toBe(
      dialogue.steps[1].id,
    );
    option.nextStepId = "";
    expect(resolveNextStepId(dialogue, first.id, option.id)).toBeNull();
  });

  it("extracts mapped lead fields from answers", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      insuranceMode: "particular",
      collectFields: ["name", "phone"],
    });
    const nameStep = dialogue.steps.find((s) => s.mapsTo === "name" || s.saveAs === "name")!;
    const phoneStep = dialogue.steps.find((s) => s.mapsTo === "phone" || s.saveAs === "phone")!;
    const fields = extractLeadFieldsFromAnswers(dialogue, {
      [nameStep.id]: "Maria",
      [phoneStep.id]: "11999990000",
    });
    expect(fields.name).toBe("Maria");
    expect(fields.phone).toBe("11999990000");
  });

  it("stores custom saveAs categories separately", () => {
    const dialogue = seedDialogueFromTemplate("appointment", {
      insuranceMode: "particular",
      collectFields: ["name"],
    });
    dialogue.customSaveLabels = { convenio: "Convênio" };
    dialogue.steps[0] = {
      ...dialogue.steps[0],
      saveAs: "convenio",
      mapsTo: undefined,
    };
    const fields = extractLeadFieldsFromAnswers(dialogue, {
      [dialogue.steps[0].id]: "Unimed",
    });
    expect(fields.custom.convenio).toBe("Unimed");
  });

  it("rejects choice steps with fewer than 2 options", () => {
    const dialogue = seedDialogueFromTemplate("appointment", {
      insuranceMode: "particular",
      collectFields: ["name"],
    });
    dialogue.steps[0].options = [{ id: "only", label: "Única" }];
    const issues = validateDialogueFlow(dialogue);
    expect(issues.some((i) => i.message.includes("pelo menos 2"))).toBe(true);
  });
});

describe("applyToneToDialogue", () => {
  it("rewrites greeting, prompts and stock contact questions when tone changes", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      insuranceMode: "both",
      collectFields: ["name", "phone", "email"],
      tone: "friendly",
    });
    const formal = applyToneToDialogue(
      dialogue,
      "formal",
      "patient-capture",
    );
    expect(formal.greeting).toContain("assistente virtual");
    expect(formal.steps[0]?.question).toBe(
      "Selecione o tipo de atendimento desejado.",
    );
    expect(formal.steps[1]?.question).toBe(
      "Informe se o atendimento será por convênio ou particular.",
    );
    const nameStep = formal.steps.find((s) => s.saveAs === "name");
    const phoneStep = formal.steps.find((s) => s.saveAs === "phone");
    expect(nameStep?.question).toBe("Por favor, informe seu nome completo.");
    expect(phoneStep?.question).toBe(
      "Informe um telefone com DDD para retorno.",
    );
  });

  it("keeps operator-edited contact questions intact", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      insuranceMode: "particular",
      collectFields: ["name"],
      tone: "friendly",
    });
    const nameStep = dialogue.steps.find((s) => s.saveAs === "name")!;
    nameStep.question = "Me diga seu nome, por favor";
    const formal = applyToneToDialogue(
      dialogue,
      "formal",
      "patient-capture",
    );
    expect(
      formal.steps.find((s) => s.saveAs === "name")?.question,
    ).toBe("Me diga seu nome, por favor");
  });

  it("shows clearly different copy in the preview by tone", () => {
    const friendlyDialogue = seedDialogueFromTemplate("patient-capture", {
      insuranceMode: "particular",
      collectFields: ["name"],
      tone: "friendly",
    });
    const formalDialogue = applyToneToDialogue(
      friendlyDialogue,
      "formal",
      "patient-capture",
    );

    const friendly = buildFlowPreview(
      {
        ...defaultFlowForTemplate("patient-capture"),
        tone: "friendly",
        dialogue: friendlyDialogue,
      },
      { botName: "Bot", clientName: "Clínica" },
    );
    const formal = buildFlowPreview(
      {
        ...defaultFlowForTemplate("patient-capture"),
        tone: "formal",
        dialogue: formalDialogue,
      },
      { botName: "Bot", clientName: "Clínica" },
    );

    expect(friendly[0]?.text).toMatch(/Oi!/);
    expect(formal[0]?.text).toMatch(/Bom dia/);
    expect(friendly.some((m) => m.text.includes("🙂"))).toBe(true);
    expect(
      formal.some((m) => m.text === "Selecione o tipo de atendimento desejado."),
    ).toBe(true);
    expect(friendly.at(-1)?.text).toContain("Prontinho!");
    expect(formal.at(-1)?.text).toContain("Agradecemos o contato");
    expect(friendly.some((m) => m.text.startsWith("Como posso te chamar"))).toBe(
      true,
    );
    expect(
      formal.some((m) => m.text === "Por favor, informe seu nome completo."),
    ).toBe(true);
  });
});
