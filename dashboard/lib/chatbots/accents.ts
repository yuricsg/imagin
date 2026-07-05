import type { AccentKey } from "./types";

export interface Accent {
  /** Saturated gradient avatar fill with a soft colored glow. */
  avatar: string;
  /** Solid identity dot. */
  dot: string;
  /** Accent-colored text. */
  text: string;
  /** Soft gradient tint for selected/highlighted surfaces. */
  surface: string;
  /** Ring color for the selected state. */
  ring: string;
  /** Colored shadow used as the selection glow. */
  glow: string;
}

/**
 * Full, literal class strings per accent. Tailwind v4 only ships classes it can
 * see in source, so these must never be built by interpolation.
 */
export const ACCENTS: Record<AccentKey, Accent> = {
  indigo: {
    avatar:
      "bg-linear-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/30",
    dot: "bg-indigo-500",
    text: "text-indigo-600 dark:text-indigo-300",
    surface:
      "bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent",
    ring: "ring-indigo-500/40",
    glow: "shadow-lg shadow-indigo-500/20",
  },
  emerald: {
    avatar:
      "bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/30",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-300",
    surface:
      "bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent",
    ring: "ring-emerald-500/40",
    glow: "shadow-lg shadow-emerald-500/20",
  },
  amber: {
    avatar:
      "bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-300",
    surface:
      "bg-linear-to-br from-amber-500/15 via-amber-500/5 to-transparent",
    ring: "ring-amber-500/40",
    glow: "shadow-lg shadow-amber-500/20",
  },
  sky: {
    avatar:
      "bg-linear-to-br from-sky-400 to-blue-600 text-white shadow-sm shadow-sky-500/30",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-300",
    surface: "bg-linear-to-br from-sky-500/15 via-sky-500/5 to-transparent",
    ring: "ring-sky-500/40",
    glow: "shadow-lg shadow-sky-500/20",
  },
  rose: {
    avatar:
      "bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/30",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-300",
    surface: "bg-linear-to-br from-rose-500/15 via-rose-500/5 to-transparent",
    ring: "ring-rose-500/40",
    glow: "shadow-lg shadow-rose-500/20",
  },
  violet: {
    avatar:
      "bg-linear-to-br from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-500/30",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-300",
    surface:
      "bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent",
    ring: "ring-violet-500/40",
    glow: "shadow-lg shadow-violet-500/20",
  },
};

/** Stable order for accent pickers and any UI that enumerates accents. */
export const ACCENT_ORDER: AccentKey[] = [
  "indigo",
  "violet",
  "sky",
  "emerald",
  "amber",
  "rose",
];
