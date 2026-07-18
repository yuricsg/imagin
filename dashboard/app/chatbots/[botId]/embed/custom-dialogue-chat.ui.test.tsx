import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chatbot } from "@/lib/chatbots/types";
import {
  FLOW_END_NO_WHATSAPP,
  type DialogueFlow,
} from "@/lib/chatbots/flows";
import type { ChatSessionTracker } from "./chat-session";
import { CustomDialogueChat } from "./custom-dialogue-chat";

const FAREWELL_FRIENDLY = "Tudo bem! Se precisar, é só chamar por aqui. 😊";

function trackerMock() {
  return {
    ensureSession: vi.fn(async () => "sess-1"),
    trackEvent: vi.fn(async () => {}),
    flush: vi.fn(async () => {}),
  } satisfies ChatSessionTracker;
}

/** Branching bot: "Quero agendar" → name step; "Não tenho interesse" → farewell. */
function makeBot(): Chatbot {
  const dialogue: DialogueFlow = {
    version: 1,
    shape: "branching",
    greeting: "Olá!",
    startStepId: "step-interesse",
    steps: [
      {
        id: "step-interesse",
        question: "Posso te ajudar a agendar?",
        inputType: "single_choice",
        required: true,
        options: [
          { id: "opt-sim", label: "Quero agendar", nextStepId: "step-nome" },
          {
            id: "opt-nao",
            label: "Não tenho interesse no momento",
            nextStepId: FLOW_END_NO_WHATSAPP,
          },
        ],
      },
      {
        id: "step-nome",
        question: "Qual é o seu nome?",
        inputType: "text",
        saveAs: "name",
        required: true,
      },
    ],
  };
  return {
    name: "Assistente",
    clientName: "Clínica Teste",
    flow: {
      templateId: "patient-capture",
      tone: "friendly",
      greeting: "",
      collectFields: ["name"],
      services: ["Consulta"],
      insuranceMode: "particular",
      insurances: [],
      dialogue,
    },
    whatsapp: {
      enabled: true,
      phoneNumber: "5511999990000",
      destinations: [{ id: "d1", label: "", phoneNumber: "5511999990000" }],
      routingQuestion: "",
      messageTemplate: "Olá, sou {nome}.",
    },
  } as unknown as Chatbot;
}

function renderChat(tracker: ChatSessionTracker) {
  return render(
    <CustomDialogueChat
      bot={makeBot()}
      botId="bot-1"
      clientId="client-1"
      source={{}}
      sessionTracker={tracker}
    />,
  );
}

beforeEach(() => {
  // jsdom gaps exercised by the chat component.
  Element.prototype.scrollIntoView = vi.fn();
  if (!("requestAnimationFrame" in window)) {
    Object.assign(window, {
      requestAnimationFrame: (cb: FrameRequestCallback) =>
        setTimeout(cb, 0) as unknown as number,
      cancelAnimationFrame: (id: number) => clearTimeout(id),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CustomDialogueChat — encerramento sem WhatsApp", () => {
  it(
    "ends politely without handoff bubbles, CTA or lead creation",
    async () => {
      const user = userEvent.setup();
      const tracker = trackerMock();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderChat(tracker);

      // Wait for the first question's options.
      const decline = await screen.findByRole(
        "button",
        { name: "Não tenho interesse no momento" },
        { timeout: 8000 },
      );
      await user.click(decline);

      // Polite goodbye appears…
      expect(await screen.findByText(FAREWELL_FRIENDLY, undefined, {
        timeout: 8000,
      })).toBeInTheDocument();
      // …with no handoff bubbles and no WhatsApp CTA.
      expect(screen.queryByText(/Prontinho!/)).toBeNull();
      expect(
        screen.queryByRole("link", { name: /WhatsApp/i }),
      ).toBeNull();
      // No lead is created on this path.
      expect(fetchMock).not.toHaveBeenCalled();

      // Funnel: the answer carries the no-interest label (the backend derives
      // `not_interested` from it) and the flow is marked completed.
      const events = tracker.trackEvent.mock.calls.map(([event]) => event);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "answer_submitted",
          stepId: "step-interesse",
          label: "Não tenho interesse no momento",
          value: "opt-nao",
        }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: "flow_completed" }),
      );
      // The handoff-only intent event never fires on this path.
      expect(
        events.some((event) => event.type === "intent_selected"),
      ).toBe(false);
    },
    20000,
  );

  it(
    "keeps the WhatsApp handoff path unchanged",
    async () => {
      const user = userEvent.setup();
      const tracker = trackerMock();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          lead: { id: "lead-1" },
          whatsappMessage: "Olá, sou Maria.",
          whatsappUrl: "https://wa.me/5511999990000?text=Ol%C3%A1",
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);
      renderChat(tracker);

      const accept = await screen.findByRole(
        "button",
        { name: "Quero agendar" },
        { timeout: 8000 },
      );
      await user.click(accept);

      const nameInput = await screen.findByRole(
        "textbox",
        undefined,
        { timeout: 8000 },
      );
      await user.type(nameInput, "Maria");
      await user.click(screen.getByRole("button", { name: "OK" }));

      // Closing bubbles and the WhatsApp CTA still show.
      expect(
        await screen.findByText(/Prontinho! Já recebemos seus dados/, undefined, {
          timeout: 8000,
        }),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole(
          "link",
          { name: /Continuar no WhatsApp/i },
          { timeout: 8000 },
        ),
      ).toBeInTheDocument();

      // Lead was created and the handoff events were tracked.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const events = tracker.trackEvent.mock.calls.map(([event]) => event);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "intent_selected" }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: "flow_completed" }),
      );
    },
    20000,
  );
});
