import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard";
import { computeMetrics } from "@/lib/metrics";
import Loading from "./loading";
import { DashboardHome } from "./_components/dashboard-home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
});

const NOW_MS = Date.parse("2026-07-05T12:00:00.000Z");

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    bots: [],
    clients: [],
    leads: [],
    accesses: [],
    dataError: null,
    metrics: computeMetrics([], []),
    botActivity: {},
    dbBotIds: [],
    nowMs: NOW_MS,
    ...overrides,
  };
}

describe("app/loading — skeleton da rota", () => {
  it("anuncia o carregamento com role=status e blocos decorativos ocultos", () => {
    render(<Loading />);

    const status = screen.getByRole("status", { name: "Carregando painel" });
    expect(status).toBeInTheDocument();
    // Skeleton blocks are pure decoration: hidden from assistive tech.
    expect(
      status.querySelectorAll("[aria-hidden='true']").length,
    ).toBeGreaterThan(0);
  });

  it("some quando o DashboardHome renderiza com dados", () => {
    render(<DashboardHome data={makeData()} />);

    expect(
      screen.queryByRole("status", { name: "Carregando painel" }),
    ).not.toBeInTheDocument();
  });
});
