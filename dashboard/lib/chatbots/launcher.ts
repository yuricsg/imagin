import type { ChatbotLauncherConfig } from "./types";

/** Default teaser when the operator has not customized the bubble yet. */
export const DEFAULT_LAUNCHER_TEASER = "Olá! Posso te ajudar?";

/** Built-in cartoon robot avatars served from the dashboard app origin. */
export const LAUNCHER_AVATAR_PRESETS = [
  {
    id: "robot",
    label: "Robô",
    description: "Animado e pronto para atender",
    path: "/embed/robot-helper.png",
  },
  {
    id: "robot-feminine",
    label: "Robô feminino",
    description: "Versão mais delicada e acolhedora",
    path: "/embed/robot-helper-feminine.png",
  },
] as const;

export type LauncherAvatarPresetId =
  (typeof LAUNCHER_AVATAR_PRESETS)[number]["id"];

/** Default avatar path (friendly cartoon robot). */
export const DEFAULT_LAUNCHER_AVATAR_PATH = LAUNCHER_AVATAR_PRESETS[0].path;

export const DEFAULT_LAUNCHER: ChatbotLauncherConfig = {
  teaserTexts: [DEFAULT_LAUNCHER_TEASER],
  avatarUrl: null,
};

const PRESET_PATHS: Set<string> = new Set(
  LAUNCHER_AVATAR_PRESETS.map((preset) => preset.path),
);

/** Absolute URL for the avatar shown on the client site. */
export function resolveLauncherAvatarUrl(
  launcher: ChatbotLauncherConfig,
  appOrigin: string,
): string {
  const origin = appOrigin.replace(/\/$/, "");
  const custom = launcher.avatarUrl?.trim();
  if (custom) {
    if (custom.startsWith("http://") || custom.startsWith("https://")) {
      return custom;
    }
    if (custom.startsWith("/")) {
      return `${origin}${custom}`;
    }
    return custom;
  }
  return `${origin}${DEFAULT_LAUNCHER_AVATAR_PATH}`;
}

/** Path used in the dashboard preview (relative to the app origin). */
export function resolveLauncherAvatarPath(
  avatarUrl: string | null | undefined,
): string {
  const custom = avatarUrl?.trim();
  if (!custom) return DEFAULT_LAUNCHER_AVATAR_PATH;
  if (custom.startsWith("http://") || custom.startsWith("https://")) {
    return custom;
  }
  if (custom.startsWith("/")) return custom;
  return DEFAULT_LAUNCHER_AVATAR_PATH;
}

/** Which built-in preset is selected, if any. */
export function matchLauncherAvatarPreset(
  avatarUrl: string | null | undefined,
): LauncherAvatarPresetId | null {
  const path = resolveLauncherAvatarPath(avatarUrl);
  const preset = LAUNCHER_AVATAR_PRESETS.find((entry) => entry.path === path);
  return preset?.id ?? null;
}

/** True when the stored URL is one of the built-in cartoon robots. */
export function isLauncherAvatarPreset(avatarUrl: string | null): boolean {
  if (!avatarUrl) return true;
  return PRESET_PATHS.has(avatarUrl.trim());
}

/** Trims, drops empties, dedupes; falls back to the default teaser. */
export function normalizeLauncherTeaserTexts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [DEFAULT_LAUNCHER_TEASER];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : [DEFAULT_LAUNCHER_TEASER];
}

/** Parses launcher from stored JSON; always returns a complete config. */
export function normalizeLauncher(raw: unknown): ChatbotLauncherConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LAUNCHER, teaserTexts: [...DEFAULT_LAUNCHER.teaserTexts] };
  }
  const record = raw as Record<string, unknown>;
  const avatarRaw = record.avatarUrl;
  let avatarUrl: string | null = null;
  if (typeof avatarRaw === "string" && avatarRaw.trim()) {
    const trimmed = avatarRaw.trim();
    // Migrate old photorealistic default to the cartoon robot.
    if (
      trimmed.endsWith("/embed/default-avatar.png") ||
      trimmed === "/embed/default-avatar.png"
    ) {
      avatarUrl = null;
    } else {
      avatarUrl = trimmed;
    }
  }
  return {
    teaserTexts: normalizeLauncherTeaserTexts(record.teaserTexts),
    avatarUrl,
  };
}

/** Builds launcher config from form fields. */
export function buildLauncherFromInput(input: {
  launcherTeaserTexts: string[];
  launcherAvatarUrl: string | null;
}): ChatbotLauncherConfig {
  const raw =
    typeof input.launcherAvatarUrl === "string" &&
    input.launcherAvatarUrl.trim()
      ? input.launcherAvatarUrl.trim()
      : null;
  // Persist null for the default robot so configs stay compact.
  const avatarUrl =
    raw === null || raw === DEFAULT_LAUNCHER_AVATAR_PATH ? null : raw;
  return {
    teaserTexts: normalizeLauncherTeaserTexts(input.launcherTeaserTexts),
    avatarUrl,
  };
}
