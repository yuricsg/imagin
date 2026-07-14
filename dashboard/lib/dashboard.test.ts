import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardData } from "./dashboard";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getDashboardData", () => {
  it("uses the server API base for chatbot and lead data", async () => {
    vi.stubEnv("API_BASE_URL", "https://server-api.example");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://public-api.example");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(
        JSON.stringify(
          url.endsWith("/api/chatbots")
            ? { chatbots: [] }
            : { leads: [], accesses: [] },
        ),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await getDashboardData();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server-api.example/api/chatbots",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://server-api.example/api/leads",
      expect.anything(),
    );
    expect(data.dataError).toBeNull();
  });
});
