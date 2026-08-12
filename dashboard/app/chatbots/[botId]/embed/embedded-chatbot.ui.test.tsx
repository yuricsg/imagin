import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddedChatbot, type ChatbotConfig } from "./embedded-chatbot";

const config: ChatbotConfig = {
  botId: "assistant",
  name: "Fast Assistant",
  flowKey: "consultation_scheduling",
  conversationFlow: {
    key: "consultation_scheduling",
    label: "Consultation",
    description: "Consultation flow",
    intents: ["schedule_consultation"],
  },
  buttonTexts: ["Book now"],
  examOptions: [],
  medicalRequestOptions: [],
  consultationNeeds: ["Appointment"],
  consultationDecisions: ["Confirm"],
};

describe("EmbeddedChatbot config handoff", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the loader config without issuing a duplicate request", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockImplementation(() =>
      Promise.reject(new Error("unexpected fetch")),
    );
    vi.spyOn(window, "postMessage").mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    render(
      <EmbeddedChatbot
        botId="assistant"
        clientId="customer"
        parentOrigin="https://client.example.com"
        initialSource={{}}
        preloaded
        expectParentConfig
      />,
    );

    expect(screen.getByText("Carregando assistente...")).toBeInTheDocument();
    fireEvent(
      window,
      new MessageEvent("message", {
        data: { type: "imagin:config", chatbot: config },
        origin: "https://client.example.com",
        source: window.parent,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Fast Assistant")).toBeInTheDocument();
      expect(screen.queryByText("Carregando assistente...")).not.toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
