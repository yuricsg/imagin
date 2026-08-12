import { describe, expect, it } from "vitest";
import type { Chatbot } from "./chatbots/types";
import { embedSnippet, WIDGET_SCRIPT_VERSION } from "./format";

describe("embedSnippet", () => {
  it("versions the public loader URL to bypass stale CDN copies", () => {
    const bot = {
      id: "assistant",
      name: "Assistant",
      clientId: "customer",
      embed: {
        appBaseUrl: "https://app.example.com",
        apiBaseUrl: "https://api.example.com",
        scriptPath: "/embed/widget.js",
      },
    } as Chatbot;

    expect(embedSnippet(bot)).toContain(
      `src="https://app.example.com/embed/widget.js?v=${WIDGET_SCRIPT_VERSION}"`,
    );
    expect(embedSnippet(bot)).toContain(
      '<link rel="preconnect" href="https://app.example.com" crossorigin>',
    );
    expect(embedSnippet(bot)).toContain(
      '<link rel="preconnect" href="https://api.example.com" crossorigin>',
    );
  });

  it("replaces an existing loader version without dropping other query params", () => {
    const bot = {
      id: "assistant",
      name: "Assistant",
      clientId: "customer",
      embed: {
        appBaseUrl: "https://app.example.com",
        apiBaseUrl: "https://api.example.com",
        scriptPath: "/embed/widget.js?locale=en&v=old",
      },
    } as Chatbot;

    const snippet = embedSnippet(bot);
    expect(snippet).toContain("locale=en");
    expect(snippet).toContain(`v=${WIDGET_SCRIPT_VERSION}`);
    expect(snippet).not.toContain("v=old");
  });

  it("emits a single preconnect when the app and API share an origin", () => {
    const bot = {
      id: "assistant",
      name: "Assistant",
      clientId: "customer",
      embed: {
        appBaseUrl: "https://app.example.com",
        apiBaseUrl: "https://app.example.com/api",
        scriptPath: "/embed/widget.js",
      },
    } as Chatbot;

    const preconnects = embedSnippet(bot).match(/rel="preconnect"/g) ?? [];
    expect(preconnects).toHaveLength(1);
  });
});
