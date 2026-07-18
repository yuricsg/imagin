import { describe, expect, it } from "vitest";
import {
  buildFlowPreview,
  defaultFlowForTemplate,
  extractLeadFieldsFromAnswers,
  applyToneToDialogue,
  farewellMessageForTone,
  FLOW_END_NO_WHATSAPP,
  isFarewellEnding,
  normalizeDialogue,
  resolveAnswerLabels,
  resolveGreeting,
  resolveNextStepId,
  seedDialogueFromTemplate,
  suggestTemplateForSpecialty,
  validateDialogueFlow,
  type DialogueFlow,
} from "./flows";

/** Dialogue with choice steps storing option ids, mirroring the reported bot. */
function choiceDialogue(): DialogueFlow {
  return {
    version: 1,
    shape: "linear",
    greeting: "",
    startStepId: "step-nome",
    steps: [
      {
        id: "step-nome",
        question: "Como posso te chamar?",
        inputType: "text",
        saveAs: "name",
      },
      {
        id: "step-exames",
        question: "Quais exames você deseja agendar?",
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
}

describe("resolveAnswerLabels", () => {
  it("maps option ids back to their labels", () => {
    const dialogue = choiceDialogue();
    const step = dialogue.steps[1];

    expect(resolveAnswerLabels(step, "opt-mrnnzskh-62")).toBe(
      "Parecer cardiológico - pré operatório",
    );
    expect(
      resolveAnswerLabels(step, ["opt-mrnnzskh-62", "opt-mrnnzpxc-61"]),
    ).toEqual(["Parecer cardiológico - pré operatório", "Teste ergométrico"]);
  });

  it("keeps unknown ids and free text unchanged", () => {
    const dialogue = choiceDialogue();
    const [textStep, choiceStep] = dialogue.steps;

    expect(resolveAnswerLabels(choiceStep, "opt-removida")).toBe("opt-removida");
    expect(resolveAnswerLabels(textStep, "gard")).toBe("gard");
    expect(resolveAnswerLabels(undefined, "qualquer")).toBe("qualquer");
  });
});

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

  it("resolves option ids to labels when extracting lead fields", () => {
    const dialogue = choiceDialogue();
    const fields = extractLeadFieldsFromAnswers(dialogue, {
      "step-nome": "gard",
      "step-exames": ["opt-mrnnzskh-62", "opt-mrnnzpxc-61"],
      "step-solicitacao": "opt-mrno0ong-67",
    });

    expect(fields.name).toBe("gard");
    expect(fields.custom.exame).toBe(
      "Parecer cardiológico - pré operatório, Teste ergométrico",
    );
    expect(fields.custom.solicitacao).toBe("Sim");
  });

  it("keeps free-text answers and unknown option ids as-is", () => {
    const dialogue = choiceDialogue();
    const fields = extractLeadFieldsFromAnswers(dialogue, {
      "step-nome": "gard",
      "step-exames": ["opt-mrnnzskh-62", "opt-removida"],
      "step-solicitacao": "Resposta digitada à mão",
    });

    expect(fields.custom.exame).toBe(
      "Parecer cardiológico - pré operatório, opt-removida",
    );
    expect(fields.custom.solicitacao).toBe("Resposta digitada à mão");
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

  it("requires a real lead name mapping", () => {
    const dialogue = seedDialogueFromTemplate("patient-capture", {
      insuranceMode: "particular",
      collectFields: ["name"],
    });
    for (const step of dialogue.steps) {
      if (step.mapsTo === "name" || step.saveAs === "name") {
        step.mapsTo = undefined;
        step.saveAs = undefined;
      }
    }
    expect(
      validateDialogueFlow(dialogue).some((issue) =>
        issue.message.includes("Nome do lead"),
      ),
    ).toBe(true);
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

describe("FLOW_END_NO_WHATSAPP (encerrar sem WhatsApp)", () => {
  /** Branching dialogue whose second option ends with the given destination. */
  function branchingDialogue(nextStepId: string | undefined): DialogueFlow {
    return {
      version: 1,
      shape: "branching",
      greeting: "Olá!",
      startStepId: "step-interesse",
      steps: [
        {
          id: "step-interesse",
          question: "Posso te ajudar a agendar?",
          inputType: "single_choice",
          options: [
            { id: "opt-sim", label: "Quero agendar", nextStepId: "step-nome" },
            {
              id: "opt-nao",
              label: "Não tenho interesse no momento",
              ...(nextStepId ? { nextStepId } : {}),
            },
          ],
        },
        {
          id: "step-nome",
          question: "Qual é o seu nome?",
          inputType: "text",
          saveAs: "name",
        },
      ],
    };
  }

  it("normalizeDialogue preserves the sentinel through a JSON round-trip", () => {
    const dialogue = branchingDialogue(FLOW_END_NO_WHATSAPP);
    const restored = normalizeDialogue(JSON.parse(JSON.stringify(dialogue)));
    expect(restored?.steps[0]?.options?.[1]?.nextStepId).toBe(
      FLOW_END_NO_WHATSAPP,
    );
  });

  it("validateDialogueFlow accepts the sentinel as a valid destination", () => {
    expect(validateDialogueFlow(branchingDialogue(FLOW_END_NO_WHATSAPP))).toEqual(
      [],
    );
    // Unknown step ids are still flagged.
    const issues = validateDialogueFlow(branchingDialogue("step-inexistente"));
    expect(issues.some((i) => i.message.includes("etapa inexistente"))).toBe(
      true,
    );
  });

  it("resolveNextStepId returns the sentinel so the runtime can branch on it", () => {
    const dialogue = branchingDialogue(FLOW_END_NO_WHATSAPP);
    expect(resolveNextStepId(dialogue, "step-interesse", "opt-nao")).toBe(
      FLOW_END_NO_WHATSAPP,
    );
    expect(isFarewellEnding(FLOW_END_NO_WHATSAPP)).toBe(true);
    expect(isFarewellEnding("step-nome")).toBe(false);
    expect(isFarewellEnding(undefined)).toBe(false);
  });

  it("preview ends with the farewell line instead of the closing line", () => {
    const dialogue = branchingDialogue(FLOW_END_NO_WHATSAPP);
    // The preview walks the first option of each step; put the declining one
    // first so the walk takes the farewell exit.
    dialogue.steps[0].options = [
      dialogue.steps[0].options![1],
      dialogue.steps[0].options![0],
    ];
    const preview = buildFlowPreview(
      {
        ...defaultFlowForTemplate("patient-capture"),
        tone: "friendly",
        dialogue,
      },
      { botName: "Bot", clientName: "Clínica" },
    );
    expect(preview.at(-1)?.text).toBe(farewellMessageForTone("friendly"));
    expect(preview.some((m) => m.text.includes("Prontinho"))).toBe(false);
    expect(preview.some((m) => m.text.includes("WhatsApp"))).toBe(false);
  });

  it("farewellMessageForTone has friendly and formal defaults", () => {
    expect(farewellMessageForTone("friendly")).toBe(
      "Tudo bem! Se precisar, é só chamar por aqui. 😊",
    );
    expect(farewellMessageForTone("formal")).toBe(
      "Agradecemos o contato. Se precisar, estamos à disposição por aqui.",
    );
  });
});
