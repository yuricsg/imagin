import type { AccentKey } from "./types";

export interface Accent {
  /** Solid avatar fill with a soft colored glow. */
  avatar: string;
  /** Solid identity dot. */
  dot: string;
  /** Accent-colored text. */
  text: string;
  /** Flat tonal tint for selected/highlighted surfaces. */
  surface: string;
  /** Ring color for the selected state. */
  ring: string;
  /** Colored shadow used as the selection glow. */
  glow: string;
}

/**
 * Full, literal class strings per accent. Tailwind v4 only ships classes it can
 * see in source, so these must never be built by interpolation. Fills and
 * surfaces are solid/tonal — gradients are not part of the Imagin system.
 */
export const ACCENTS: Record<AccentKey, Accent> = {
  indigo: {
    avatar: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30",
    dot: "bg-indigo-500",
    text: "text-indigo-600 dark:text-indigo-300",
    surface: "bg-indigo-500/10",
    ring: "ring-indigo-500/40",
    glow: "shadow-lg shadow-indigo-500/20",
  },
  emerald: {
    avatar: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-300",
    surface: "bg-emerald-500/10",
    ring: "ring-emerald-500/40",
    glow: "shadow-lg shadow-emerald-500/20",
  },
  amber: {
    avatar: "bg-amber-600 text-white shadow-sm shadow-amber-600/30",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    surface: "bg-amber-500/10",
    ring: "ring-amber-500/40",
    glow: "shadow-lg shadow-amber-500/20",
  },
  sky: {
    avatar: "bg-sky-600 text-white shadow-sm shadow-sky-600/30",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-300",
    surface: "bg-sky-500/10",
    ring: "ring-sky-500/40",
    glow: "shadow-lg shadow-sky-500/20",
  },
  rose: {
    avatar: "bg-rose-600 text-white shadow-sm shadow-rose-600/30",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-300",
    surface: "bg-rose-500/10",
    ring: "ring-rose-500/40",
    glow: "shadow-lg shadow-rose-500/20",
  },
  violet: {
    avatar: "bg-violet-600 text-white shadow-sm shadow-violet-600/30",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-300",
    surface: "bg-violet-500/10",
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
