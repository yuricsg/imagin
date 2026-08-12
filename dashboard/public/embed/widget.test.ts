import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const widgetSource = readFileSync(
  path.join(process.cwd(), "public/embed/widget.js"),
  "utf8",
);

const publicChatbot = {
  botId: "assistant",
  name: "Assistant",
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

describe("public widget loader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("preloads the static embed shell shortly after the page settles", async () => {
    installConnection({ effectiveType: "4g", saveData: false });
    installFetch();
    const root = mountWidget();

    expect(root.shadowRoot?.querySelector("iframe")).toBeNull();
    await vi.advanceTimersByTimeAsync(899);
    expect(root.shadowRoot?.querySelector("iframe")).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    const frame = root.shadowRoot?.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.src).toContain("/embed/chat?");
    expect(frame?.src).toContain("botId=assistant");
    expect(frame?.src).toContain("configHandoff=1");
  });

  it("keeps preload on demand for Data Saver visitors", async () => {
    installConnection({ effectiveType: "4g", saveData: true });
    installFetch();
    const root = mountWidget("data-saver");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(root.shadowRoot?.querySelector("iframe")).toBeNull();

    root.shadowRoot?.querySelector<HTMLButtonElement>(".imagin-launcher")?.click();
    expect(root.shadowRoot?.querySelector("iframe")).not.toBeNull();
  });

  it("reuses the loader config request when the iframe announces readiness", async () => {
    installConnection({ effectiveType: "4g", saveData: false });
    const fetchMock = installFetch();
    const root = mountWidget("handoff");
    root.shadowRoot?.querySelector<HTMLButtonElement>(".imagin-launcher")?.click();
    await Promise.resolve();

    const frame = root.shadowRoot?.querySelector("iframe");
    expect(frame).not.toBeNull();
    const postMessage = vi.fn();
    const frameWindow = { postMessage };
    Object.defineProperty(frame, "contentWindow", {
      configurable: true,
      value: frameWindow,
    });

    const readyEvent = new Event("message");
    Object.defineProperties(readyEvent, {
      data: { value: { type: "imagin:config-ready" } },
      source: { value: frameWindow },
    });
    window.dispatchEvent(readyEvent);

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        { type: "imagin:config", chatbot: publicChatbot },
        "https://app.example.com",
      );
    });
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes("/config")),
    ).toHaveLength(1);
  });
});

function mountWidget(clientId = "customer") {
  const script = document.createElement("script");
  script.src = "https://app.example.com/embed/widget.js";
  script.dataset.botId = "assistant";
  script.dataset.clientId = clientId;
  script.dataset.apiBaseUrl = "https://api.example.com";
  document.body.appendChild(script);
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: script,
  });

  window.eval(widgetSource);
  return document.getElementById(`imagin-widget-assistant-${clientId}`)!;
}

function installConnection(connection: { effectiveType: string; saveData: boolean }) {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value: connection,
  });
}

function installFetch() {
  return vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/health")) {
      return { ok: true } as Response;
    }
    return {
      ok: true,
      json: async () => ({ chatbot: publicChatbot }),
    } as Response;
  });
}
