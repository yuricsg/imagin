import type { ChatAccess, Lead, LeadChannel } from "./chatbots/types";

/**
 * Per-channel performance for a single bot. Channels are grouped the way an
 * operator reads a media report: the two paid sources stand alone, organic
 * search stands alone, and everything else (direct/referral/unknown) is noise
 * collapsed into "Outros".
 */
export type ChannelGroupId = "organic" | "meta" | "google" | "other";

export const CHANNEL_GROUP_ORDER: readonly ChannelGroupId[] = [
  "organic",
  "meta",
  "google",
  "other",
];

export const CHANNEL_GROUP_LABELS: Record<ChannelGroupId, string> = {
  organic: "Busca Orgânica",
  meta: "Meta Ads",
  google: "Google Ads",
  other: "Outros",
};

export function channelGroupFor(channel: LeadChannel): ChannelGroupId {
  switch (channel) {
    case "organic":
      return "organic";
    case "meta":
      return "meta";
    case "google":
      return "google";
    default:
      return "other";
  }
}

/** One day of the sparkline. */
export interface ChannelPoint {
  date: string;
  accesses: number;
  leads: number;
  completed: number;
}

export interface ChannelReport {
  id: ChannelGroupId;
  label: string;
  /** Visitors that opened the chat from this channel. */
  accesses: number;
  /** Visitors that identified themselves (became a lead). */
  leads: number;
  /** Leads that reached the end of the flow. */
  completed: number;
  /** leads / accesses — how well the channel's traffic converts. */
  conversionRate: number;
  /** completed / leads — how well the flow holds this channel's leads. */
  completionRate: number;
  series: ChannelPoint[];
}

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight — buckets follow the operator's calendar, not UTC. */
function startOfDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayKey(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** First millisecond of the oldest day still inside the period. */
export function periodStartMs(nowMs: number, days: number): number {
  return startOfDayMs(nowMs) - (days - 1) * DAY_MS;
}

/**
 * Buckets leads and accesses by channel and by day. Callers pass data already
 * scoped to one bot; anything older than the period is ignored so the totals
 * and the sparkline always describe the same window.
 */
export function computeChannelReports(
  leads: Lead[],
  accesses: ChatAccess[],
  options: { nowMs: number; days: number },
): ChannelReport[] {
  const { nowMs, days } = options;
  const startMs = periodStartMs(nowMs, days);

  const groups = new Map<
    ChannelGroupId,
    { accesses: number; leads: number; completed: number; series: Map<string, ChannelPoint> }
  >();
  for (const id of CHANNEL_GROUP_ORDER) {
    const series = new Map<string, ChannelPoint>();
    for (let i = 0; i < days; i += 1) {
      const key = dayKey(startMs + i * DAY_MS);
      series.set(key, { date: key, accesses: 0, leads: 0, completed: 0 });
    }
    groups.set(id, { accesses: 0, leads: 0, completed: 0, series });
  }

  for (const access of accesses) {
    const at = Date.parse(access.openedAt);
    if (!Number.isFinite(at) || at < startMs) continue;
    const group = groups.get(channelGroupFor(access.attribution.channel));
    if (!group) continue;
    group.accesses += 1;
    const point = group.series.get(dayKey(at));
    if (point) point.accesses += 1;
  }

  for (const lead of leads) {
    const at = Date.parse(lead.createdAt);
    if (!Number.isFinite(at) || at < startMs) continue;
    const group = groups.get(channelGroupFor(lead.attribution.channel));
    if (!group) continue;
    const isComplete = Boolean(lead.progress.completedAt);
    group.leads += 1;
    if (isComplete) group.completed += 1;
    const point = group.series.get(dayKey(at));
    if (point) {
      point.leads += 1;
      if (isComplete) point.completed += 1;
    }
  }

  return CHANNEL_GROUP_ORDER.map((id) => {
    const group = groups.get(id)!;
    return {
      id,
      label: CHANNEL_GROUP_LABELS[id],
      accesses: group.accesses,
      leads: group.leads,
      completed: group.completed,
      conversionRate: group.accesses === 0 ? 0 : group.leads / group.accesses,
      completionRate: group.leads === 0 ? 0 : group.completed / group.leads,
      series: [...group.series.values()],
    };
  });
}

/** True when the period has nothing to show — drives the empty state. */
export function isEmptyReport(reports: ChannelReport[]): boolean {
  return reports.every((report) => report.accesses === 0 && report.leads === 0);
}

/** The four measures each channel is reported on, in display order. */
export type TileMetric = "leads" | "conversion" | "accesses" | "completion";

export interface TilePoint {
  date: string;
  value: number;
}

/**
 * Flattens a channel's daily buckets into the single measure a tile plots.
 * Rates are 0 on days with no denominator rather than undefined, so the
 * sparkline stays continuous instead of breaking into segments.
 */
export function tilePoints(
  series: ChannelPoint[],
  metric: TileMetric,
): TilePoint[] {
  return series.map((point) => {
    switch (metric) {
      case "leads":
        return { date: point.date, value: point.leads };
      case "accesses":
        return { date: point.date, value: point.accesses };
      case "conversion":
        return {
          date: point.date,
          value: point.accesses === 0 ? 0 : point.leads / point.accesses,
        };
      case "completion":
        return {
          date: point.date,
          value: point.leads === 0 ? 0 : point.completed / point.leads,
        };
    }
  });
}
