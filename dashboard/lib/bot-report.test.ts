import { describe, expect, it } from "vitest";
import type { ChatAccess, Lead, LeadChannel } from "./chatbots/types";
import {
  channelGroupFor,
  computeChannelReports,
  isEmptyReport,
} from "./bot-report";

const NOW = new Date("2026-07-16T12:00:00").getTime();
const DAY = 24 * 60 * 60 * 1000;

function access(channel: LeadChannel, atMs = NOW): ChatAccess {
  return {
    id: `a-${Math.random()}`,
    botId: "bot-1",
    clientId: "c-1",
    openedAt: new Date(atMs).toISOString(),
    attribution: {
      channel,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    },
  } as ChatAccess;
}

function lead(channel: LeadChannel, completed: boolean, atMs = NOW): Lead {
  return {
    id: `l-${Math.random()}`,
    botId: "bot-1",
    clientId: "c-1",
    createdAt: new Date(atMs).toISOString(),
    attribution: {
      channel,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    },
    progress: {
      completedAt: completed ? new Date(atMs).toISOString() : null,
    },
  } as unknown as Lead;
}

function byId(reports: ReturnType<typeof computeChannelReports>, id: string) {
  return reports.find((r) => r.id === id)!;
}

describe("channelGroupFor", () => {
  it("keeps paid and organic apart, and collapses the rest into 'other'", () => {
    expect(channelGroupFor("organic")).toBe("organic");
    expect(channelGroupFor("meta")).toBe("meta");
    expect(channelGroupFor("google")).toBe("google");
    expect(channelGroupFor("direct")).toBe("other");
    expect(channelGroupFor("referral")).toBe("other");
    expect(channelGroupFor("unknown")).toBe("other");
  });
});

describe("computeChannelReports", () => {
  it("reproduces the reference report numbers", () => {
    // Busca Orgânica: 17 acessos, 6 leads (4 completos)
    //   → conversão 6/17 = 35.29%, completos 4/6 = 66.67%
    const accesses = Array.from({ length: 17 }, () => access("organic"));
    const leads = [
      ...Array.from({ length: 4 }, () => lead("organic", true)),
      ...Array.from({ length: 2 }, () => lead("organic", false)),
    ];

    const organic = byId(
      computeChannelReports(leads, accesses, { nowMs: NOW, days: 30 }),
      "organic",
    );

    expect(organic.accesses).toBe(17);
    expect(organic.leads).toBe(6);
    expect(organic.completed).toBe(4);
    expect(organic.conversionRate).toBeCloseTo(0.3529, 4);
    expect(organic.completionRate).toBeCloseTo(0.6667, 4);
  });

  it("reports zero rates instead of dividing by zero", () => {
    // Meta na foto: 1 acesso, 0 leads → 0% conversão e 0% completos
    const reports = computeChannelReports([], [access("meta")], {
      nowMs: NOW,
      days: 30,
    });
    const meta = byId(reports, "meta");
    expect(meta.accesses).toBe(1);
    expect(meta.conversionRate).toBe(0);
    expect(meta.completionRate).toBe(0);
  });

  it("always returns every channel group, in a stable order", () => {
    const reports = computeChannelReports([], [], { nowMs: NOW, days: 7 });
    expect(reports.map((r) => r.id)).toEqual([
      "organic",
      "meta",
      "google",
      "other",
    ]);
    expect(isEmptyReport(reports)).toBe(true);
  });

  it("ignores data older than the period", () => {
    const reports = computeChannelReports(
      [lead("google", true, NOW - 10 * DAY)],
      [access("google", NOW - 10 * DAY)],
      { nowMs: NOW, days: 7 },
    );
    const google = byId(reports, "google");
    expect(google.leads).toBe(0);
    expect(google.accesses).toBe(0);
    expect(isEmptyReport(reports)).toBe(true);
  });

  it("builds one sparkline point per day, oldest first", () => {
    const reports = computeChannelReports(
      [lead("organic", true, NOW - 2 * DAY)],
      [access("organic", NOW - 2 * DAY), access("organic", NOW)],
      { nowMs: NOW, days: 7 },
    );
    const organic = byId(reports, "organic");

    expect(organic.series).toHaveLength(7);
    expect(organic.series[0].date < organic.series[6].date).toBe(true);
    // Today is the last bucket and holds the second access.
    expect(organic.series[6].accesses).toBe(1);
    // The lead two days ago lands in its own bucket, with its access.
    expect(organic.series[4]).toMatchObject({
      accesses: 1,
      leads: 1,
      completed: 1,
    });
  });
});
